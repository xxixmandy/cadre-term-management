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

// 自定义验证schema - 所有字段都可选
const updateCadreSchema = z.object({
  name: z.string().optional(),
  gender: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  termStartDate: z.string().optional().nullable(),
  termDuration: z.number().optional().nullable(),
  termEndDate: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  isTemporary: z.boolean().optional(),
});

// 更新干部信息
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // 验证数据
    const validatedData = updateCadreSchema.parse(body);
    
    const client = getSupabaseClient();
    
    // 先获取当前数据
    const { data: currentData } = await client
      .from('cadres')
      .select('*')
      .eq('id', id)
      .single();
    
    if (!currentData) {
      return NextResponse.json({ error: '未找到该干部' }, { status: 404 });
    }
    
    // 合并数据，处理字段名映射
    const mergedBirthDate = validatedData.birthDate !== undefined ? validatedData.birthDate : currentData.birth_date;
    const mergedTermStartDate = validatedData.termStartDate !== undefined ? validatedData.termStartDate : currentData.term_start_date;
    const mergedTermDuration = validatedData.termDuration !== undefined ? validatedData.termDuration : currentData.term_duration;
    const mergedTermEndDate = validatedData.termEndDate !== undefined ? validatedData.termEndDate : currentData.term_end_date;
    
    // 计算退休日期和任期结束日期
    let retirementDate: string | null = currentData.retirement_date;
    let finalEndDate: string | null = currentData.term_end_date;
    let status = currentData.status;
    
    if (mergedBirthDate) {
      const retirement = calculateRetirementDate(mergedBirthDate);
      retirementDate = dateToStr(retirement);
    }
    
    if (mergedTermStartDate && mergedBirthDate) {
      const result = calculateFinalTermEndDate(
        mergedTermStartDate,
        mergedTermDuration || null,
        mergedTermEndDate || null,
        mergedBirthDate
      );
      finalEndDate = dateToStr(result.finalEndDate);
      status = calculateTermStatus(result.finalEndDate);
    } else if (mergedTermEndDate) {
      finalEndDate = mergedTermEndDate;
      status = calculateTermStatus(mergedTermEndDate);
    }
    
    // 构建更新数据
    const updateData: Record<string, unknown> = {};
    
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.gender !== undefined) updateData.gender = validatedData.gender;
    if (validatedData.birthDate !== undefined) updateData.birth_date = validatedData.birthDate;
    if (validatedData.department !== undefined) updateData.department = validatedData.department;
    if (validatedData.position !== undefined) updateData.position = validatedData.position;
    if (validatedData.termStartDate !== undefined) updateData.term_start_date = validatedData.termStartDate;
    if (validatedData.termDuration !== undefined) updateData.term_duration = validatedData.termDuration;
    if (validatedData.remarks !== undefined) updateData.remarks = validatedData.remarks;
    if (validatedData.isTemporary !== undefined) updateData.is_temporary = validatedData.isTemporary;
    
    updateData.retirement_date = retirementDate;
    updateData.term_end_date = finalEndDate;
    updateData.status = status;
    updateData.updated_at = new Date().toISOString();
    
    const { data, error } = await client
      .from('cadres')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ data, message: '更新成功' });
  } catch (error) {
    console.error('Error updating cadre:', error);
    return NextResponse.json(
      { error: '更新干部信息失败' },
      { status: 500 }
    );
  }
}

// 删除干部
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getSupabaseClient();
    
    const { error } = await client
      .from('cadres')
      .delete()
      .eq('id', id);
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ message: '删除成功' });
  } catch (error) {
    console.error('Error deleting cadre:', error);
    return NextResponse.json(
      { error: '删除干部失败' },
      { status: 500 }
    );
  }
}
