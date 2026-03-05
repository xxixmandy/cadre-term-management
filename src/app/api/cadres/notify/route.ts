import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getDaysUntilExpiry, formatDate } from '@/lib/cadre-utils';

/**
 * 自动提醒API
 * 检查所有干部的任期状态，对需要提醒的干部发送企业微信通知
 * 
 * 提醒规则：
 * - 任期结束前两个月（60天）
 * - 任期结束前半个月（15天）
 * - 任期结束前一天（1天）
 * - 任期当天
 * 
 * 调用方式：
 * - GET: 由 Vercel Cron Jobs 自动调用（每天0点执行）
 * - POST: 手动触发（可带 testMode 参数测试）
 */

// 发送企业微信消息
async function sendWeChatNotification(webhookUrl: string, content: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        msgtype: 'text',
        text: {
          content,
          mentioned_list: ['@all'],
        },
      }),
    });
    
    const result = await response.json();
    
    if (result.errcode !== 0) {
      return { success: false, error: result.errmsg || '发送失败' };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error sending notification:', error);
    return { success: false, error: '网络请求失败' };
  }
}

// 构建提醒消息
function buildNotificationMessage(cadre: {
  name: string;
  department: string | null;
  position: string | null;
  term_start_date: string | null;
  term_end_date: string | null;
  term_end_date_original: string | null;
  remarks: string | null;
}, daysUntilExpiry: number, notifyType: string): string {
  let content = `【干部任期提醒】\n\n`;
  content += `📢 ${notifyType}\n\n`;
  content += `👤 姓名：${cadre.name}\n`;
  
  if (cadre.department) {
    content += `🏢 部门：${cadre.department}\n`;
  }
  
  if (cadre.position) {
    content += `💼 岗位：${cadre.position}\n`;
  }
  
  if (cadre.term_start_date) {
    content += `📅 任期开始：${formatDate(cadre.term_start_date)}\n`;
  }
  
  // 显示原始任期结束时间描述（如果有）
  if (cadre.term_end_date_original) {
    content += `📅 任期结束：${cadre.term_end_date_original}\n`;
  } else if (cadre.term_end_date) {
    content += `📅 任期结束：${formatDate(cadre.term_end_date)}\n`;
  }
  
  if (daysUntilExpiry > 0) {
    content += `\n⏰ 距离到期还有 ${daysUntilExpiry} 天`;
  } else if (daysUntilExpiry === 0) {
    content += `\n⚠️ 今天到期！`;
  } else {
    content += `\n⚠️ 已过期 ${Math.abs(daysUntilExpiry)} 天`;
  }
  
  if (cadre.remarks) {
    content += `\n\n📝 备注：${cadre.remarks}`;
  }
  
  return content;
}

// 核心提醒逻辑
async function runNotificationCheck(testMode: boolean = false) {
  const client = getSupabaseClient();
  
  // 获取全局webhook配置
  const { data: webhookSetting } = await client
    .from('settings')
    .select('value')
    .eq('key', 'webhook_url')
    .single();
  
  if (!webhookSetting?.value) {
    return { 
      success: false, 
      error: '未配置企业微信Webhook地址，请先在设置中配置',
      notifications: []
    };
  }
  
  const webhookUrl = webhookSetting.value;
  
  // 获取所有有任期结束日期的干部
  const { data: cadres, error } = await client
    .from('cadres')
    .select('*')
    .not('term_end_date', 'is', null);
  
  if (error) {
    return { success: false, error: error.message, notifications: [] };
  }
  
  if (!cadres || cadres.length === 0) {
    return { 
      success: true,
      message: '没有需要检查的干部信息',
      notifications: []
    };
  }
  
  const notifications: Array<{
    name: string;
    notifyType: string;
    daysUntilExpiry: number;
    success: boolean;
    error?: string;
  }> = [];
  
  const needNotifyCadres: Array<{ cadre: typeof cadres[0]; days: number; notifyType: string }> = [];
  
  for (const cadre of cadres) {
    const daysUntilExpiry = getDaysUntilExpiry(cadre.term_end_date);
    
    // 检查是否需要提醒
    let shouldNotify = false;
    let notifyType = '';
    
    // 刚好到期前两个月（60天）
    if (daysUntilExpiry === 60) {
      shouldNotify = true;
      notifyType = '两个月后到期';
    }
    // 刚好到期前半个月（15天）
    else if (daysUntilExpiry === 15) {
      shouldNotify = true;
      notifyType = '半个月后到期';
    }
    // 到期前一天或当天
    else if (daysUntilExpiry === 1 || daysUntilExpiry === 0) {
      shouldNotify = true;
      notifyType = daysUntilExpiry === 0 ? '今天到期' : '明天到期';
    }
    
    if (shouldNotify && daysUntilExpiry !== null) {
      needNotifyCadres.push({ cadre, days: daysUntilExpiry, notifyType });
    }
    
    // 测试模式：所有即将到期和已到期的都需要通知
    if (testMode && daysUntilExpiry !== null && daysUntilExpiry <= 60) {
      if (!needNotifyCadres.find(n => n.cadre.id === cadre.id)) {
        needNotifyCadres.push({ 
          cadre, 
          days: daysUntilExpiry, 
          notifyType: daysUntilExpiry <= 0 ? '已到期' : 
                     daysUntilExpiry <= 15 ? '即将到期' : '两个月内到期'
        });
      }
    }
  }
  
  // 发送提醒
  for (const { cadre, days, notifyType } of needNotifyCadres) {
    const message = buildNotificationMessage(cadre, days, notifyType);
    const result = await sendWeChatNotification(webhookUrl, message);
    
    notifications.push({
      name: cadre.name,
      notifyType,
      daysUntilExpiry: days,
      success: result.success,
      error: result.error,
    });
  }
  
  return {
    success: true,
    message: needNotifyCadres.length > 0 
      ? `已发送 ${needNotifyCadres.length} 条提醒` 
      : '今天没有需要提醒的干部',
    checkedCount: cadres.length,
    notifications,
  };
}

// GET: 由 Vercel Cron Jobs 自动调用（每天0点执行）
export async function GET(request: NextRequest) {
  try {
    // 验证请求来源（可选：可以添加 Authorization header 验证）
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // 如果设置了 CRON_SECRET，则验证
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log(`[Cron] 开始执行定时提醒检查 - ${new Date().toISOString()}`);
    const result = await runNotificationCheck(false);
    console.log(`[Cron] 提醒检查完成 - ${JSON.stringify(result)}`);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in cron notification:', error);
    return NextResponse.json(
      { success: false, error: '执行失败: ' + (error instanceof Error ? error.message : '未知错误') },
      { status: 500 }
    );
  }
}

// POST: 手动触发提醒
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { testMode } = body;
    
    const result = await runNotificationCheck(testMode);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in manual notification:', error);
    return NextResponse.json(
      { success: false, error: '执行失败: ' + (error instanceof Error ? error.message : '未知错误') },
      { status: 500 }
    );
  }
}
