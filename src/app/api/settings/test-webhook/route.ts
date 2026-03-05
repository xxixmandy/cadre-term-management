import { NextRequest, NextResponse } from 'next/server';

/**
 * 测试企业微信 Webhook 连接
 * 发送一条测试消息到企业微信群
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { webhookUrl } = body;
    
    if (!webhookUrl) {
      return NextResponse.json({ 
        success: false, 
        message: '请提供 Webhook 地址' 
      }, { status: 400 });
    }
    
    // 验证 webhook URL 格式
    if (!webhookUrl.startsWith('https://qyapi.weixin.qq.com/cgi-bin/webhook/send')) {
      return NextResponse.json({ 
        success: false, 
        message: 'Webhook 地址格式不正确，应以 https://qyapi.weixin.qq.com/cgi-bin/webhook/send 开头' 
      }, { status: 400 });
    }
    
    // 发送测试消息
    const testMessage = `【干部任期管理系统】\n\n✅ Webhook 连接测试成功\n📅 测试时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        msgtype: 'text',
        text: {
          content: testMessage,
        },
      }),
    });
    
    const result = await response.json();
    
    if (result.errcode === 0) {
      return NextResponse.json({ 
        success: true, 
        message: '连接测试成功，测试消息已发送到企业微信群' 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        message: `发送失败: ${result.errmsg || '未知错误'}` 
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error testing webhook:', error);
    return NextResponse.json({ 
      success: false, 
      message: '测试失败: ' + (error instanceof Error ? error.message : '网络请求失败') 
    }, { status: 500 });
  }
}
