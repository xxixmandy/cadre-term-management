import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取配置
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const key = searchParams.get('key');
    
    const client = getSupabaseClient();
    
    if (key) {
      // 获取单个配置
      const { data, error } = await client
        .from('settings')
        .select('*')
        .eq('key', key)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      return NextResponse.json({ data: data?.value || null });
    } else {
      // 获取所有配置
      const { data, error } = await client
        .from('settings')
        .select('*');
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      // 转换为键值对对象
      const settings: Record<string, string | null> = {};
      data?.forEach(item => {
        settings[item.key] = item.value;
      });
      
      return NextResponse.json({ data: settings });
    }
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: '获取配置失败' },
      { status: 500 }
    );
  }
}

// 设置配置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value, description } = body;
    
    if (!key) {
      return NextResponse.json({ error: '配置键不能为空' }, { status: 400 });
    }
    
    const client = getSupabaseClient();
    
    // 使用 upsert 插入或更新
    const { data, error } = await client
      .from('settings')
      .upsert({
        key,
        value: value || null,
        description: description || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'key',
      })
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ data, message: '配置保存成功' });
  } catch (error) {
    console.error('Error saving setting:', error);
    return NextResponse.json(
      { error: '保存配置失败' },
      { status: 500 }
    );
  }
}

// 删除配置
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const key = searchParams.get('key');
    
    if (!key) {
      return NextResponse.json({ error: '配置键不能为空' }, { status: 400 });
    }
    
    const client = getSupabaseClient();
    
    const { error } = await client
      .from('settings')
      .delete()
      .eq('key', key);
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ message: '配置删除成功' });
  } catch (error) {
    console.error('Error deleting setting:', error);
    return NextResponse.json(
      { error: '删除配置失败' },
      { status: 500 }
    );
  }
}
