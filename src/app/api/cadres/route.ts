import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { z } from 'zod';
import { 
  calculateRetirementDate, 
  calculateFinalTermEndDate, 
  calculateTermStatus 
} from '@/lib/cadre-utils';

/**
 * 将 Date 对象转换为 YYYY-MM-DD 字符串（避免时区问题）
 */
function dateToStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// 自定义验证schema - 只要求name必填
const addCadreSchema = z.object({
  name: z.string().min(1, '姓名不能为空'),
  gender: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  termStartDate: z.string().optional().nullable(),
  termDuration: z.number().optional().nullable(),
  termEndDate: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  isTemporary: z.boolean().optional().default(false),
});

// 获取所有干部列表
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    
    // 获取排序参数
    const sortBy = searchParams.get('sortBy') || 'term_end_date';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    const searchQuery = searchParams.get('search') || '';
    
    let query = client
      .from('cadres')
      .select('*');
    
    // 搜索功能
    if (searchQuery) {
      query = query.or(
        `name.ilike.%${searchQuery}%,department.ilike.%${searchQuery}%,position.ilike.%${searchQuery}%,remarks.ilike.%${searchQuery}%`
      );
    }
    
    // 排序
    if (sortBy === 'term_end_date') {
      query = query.order('term_end_date', { ascending: sortOrder === 'asc', nullsFirst: false });
    } else if (sortBy === 'term_start_date') {
      query = query.order('term_start_date', { ascending: sortOrder === 'asc' });
    } else if (sortBy === 'status') {
      query = query.order('status', { ascending: sortOrder === 'asc' });
    } else if (sortBy === 'name') {
      query = query.order('name', { ascending: sortOrder === 'asc' });
    }
    
    const { data, error } = await query;
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // 更新状态
    const updatedData = data?.map(cadre => {
      const status = calculateTermStatus(cadre.term_end_date);
      return { ...cadre, status };
    });
    
    return NextResponse.json({ data: updatedData });
  } catch (error) {
    console.error('Error fetching cadres:', error);
    return NextResponse.json(
      { error: '获取干部列表失败' },
      { status: 500 }
    );
  }
}

// 添加新干部 - 放宽验证，只要求name必填
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 验证数据 - 只要求name必填
    const validatedData = addCadreSchema.parse(body);
    
    let retirementDate: string | null = null;
    let finalEndDate: string | null = null;
    let status = '在任';
    
    // 只有有出生日期才计算退休时间
    if (validatedData.birthDate) {
      const retirement = calculateRetirementDate(validatedData.birthDate);
      retirementDate = dateToStr(retirement);
    }
    
    // 只有有任期开始时间和出生日期才计算结束时间
    if (validatedData.termStartDate && validatedData.birthDate) {
      const result = calculateFinalTermEndDate(
        validatedData.termStartDate,
        validatedData.termDuration || null,
        validatedData.termEndDate || null,
        validatedData.birthDate
      );
      finalEndDate = dateToStr(result.finalEndDate);
      status = calculateTermStatus(result.finalEndDate);
    } else if (validatedData.termEndDate) {
      // 只有结束时间，没有开始时间和出生日期
      finalEndDate = validatedData.termEndDate;
      status = calculateTermStatus(validatedData.termEndDate);
    }
    
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('cadres')
      .insert({
        name: validatedData.name,
        gender: validatedData.gender || null,
        birth_date: validatedData.birthDate || null,
        department: validatedData.department || null,
        position: validatedData.position || null,
        term_start_date: validatedData.termStartDate || null,
        term_duration: validatedData.termDuration || null,
        term_end_date: finalEndDate,
        retirement_date: retirementDate,
        remarks: validatedData.remarks || null,
        is_temporary: validatedData.isTemporary || false,
        status,
      })
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ data, message: '添加成功' });
  } catch (error) {
    console.error('Error adding cadre:', error);
    return NextResponse.json(
      { error: '添加干部失败' },
      { status: 500 }
    );
  }
}
