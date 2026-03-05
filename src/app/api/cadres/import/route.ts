import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { calculateRetirementDate, calculateFinalTermEndDate, calculateTermStatus } from '@/lib/cadre-utils';
import * as XLSX from 'xlsx';

/**
 * 将年月日格式化为 YYYY-MM-DD 字符串（避免时区问题）
 */
function formatDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * 将 Date 对象转换为 YYYY-MM-DD 字符串（避免时区问题）
 */
function dateToStr(date: Date): string {
  return formatDateStr(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/**
 * 解析多种格式的日期，返回日期字符串、是否为暂定时间、原始完整字符串
 * 直接返回 YYYY-MM-DD 格式字符串，避免时区转换问题
 */
function parseDateWithFlag(dateStr: string): { dateStr: string | null; isTemporary: boolean; originalStr: string } {
  if (!dateStr) return { dateStr: null, isTemporary: false, originalStr: '' };
  
  // 清理字符串
  const cleanStr = String(dateStr).trim();
  
  // 检查是否为暂定时间 - 支持多种表达方式
  let isTemporary = /暂定|预计|拟定|初步|约/.test(cleanStr);
  
  // 策略1: 优先提取括号内的暂定日期，如 "xxx（暂定2025.09.30）"
  const bracketMatch = cleanStr.match(/[（(]暂定(\d{4})[.年\-\/](\d{1,2})[.月\-\/]?(\d{0,2})[日）)]?/);
  if (bracketMatch) {
    const year = parseInt(bracketMatch[1]);
    const month = parseInt(bracketMatch[2]);
    const day = bracketMatch[3] ? parseInt(bracketMatch[3]) : 1;
    if (!isNaN(year) && !isNaN(month)) {
      return { dateStr: formatDateStr(year, month, day), isTemporary: true, originalStr: cleanStr };
    }
  }
  
  // 策略2: 提取括号内的日期（无暂定词但有括号），如 "xxx（2025.09.30）"
  const simpleBracketMatch = cleanStr.match(/[（(](\d{4})[.年\-\/](\d{1,2})[.月\-\/]?(\d{0,2})[日）)]?/);
  if (simpleBracketMatch) {
    const year = parseInt(simpleBracketMatch[1]);
    const month = parseInt(simpleBracketMatch[2]);
    const day = simpleBracketMatch[3] ? parseInt(simpleBracketMatch[3]) : 1;
    if (!isNaN(year) && !isNaN(month)) {
      return { dateStr: formatDateStr(year, month, day), isTemporary, originalStr: cleanStr };
    }
  }
  
  // 策略3: 提取"暂定"后面的直接日期，如 "暂定2025.09.30" 或 "暂定2025年9月30日"
  const tempDateMatch = cleanStr.match(/暂定\s*(\d{4})[.年\-\/](\d{1,2})[.月\-\/]?(\d{0,2})[日]?/);
  if (tempDateMatch) {
    const year = parseInt(tempDateMatch[1]);
    const month = parseInt(tempDateMatch[2]);
    const day = tempDateMatch[3] ? parseInt(tempDateMatch[3]) : 1;
    if (!isNaN(year) && !isNaN(month)) {
      return { dateStr: formatDateStr(year, month, day), isTemporary: true, originalStr: cleanStr };
    }
  }
  
  // 策略4: 处理"X年底"这种表达
  if (cleanStr.includes('底')) {
    const yearMatch = cleanStr.match(/(\d{4})/);
    if (yearMatch) {
      return { dateStr: formatDateStr(parseInt(yearMatch[1]), 12, 31), isTemporary: true, originalStr: cleanStr };
    }
  }
  
  // 策略5: 尝试多种标准日期格式（不带中文描述）
  const formats = [
    /^(\d{4})年(\d{1,2})月(\d{1,2})日?$/,      // 2024年1月1日
    /^(\d{4})年(\d{1,2})月$/,                   // 2024年1月
    /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/, // 2024-01-01
    /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/,         // 2024.01.01
    /^(\d{4})[\/\-](\d{1,2})$/,                 // 2024-01
    /^(\d{4})\.(\d{1,2})$/,                     // 2024.01
  ];
  
  for (const format of formats) {
    const match = cleanStr.match(format);
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      const day = match[3] ? parseInt(match[3]) : 1;
      
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        return { dateStr: formatDateStr(year, month, day), isTemporary, originalStr: cleanStr };
      }
    }
  }
  
  // 策略6: 尝试直接解析（处理ISO格式等），但要避免时区问题
  // 如果已经是 YYYY-MM-DD 格式，直接返回
  const isoMatch = cleanStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return { dateStr: cleanStr, isTemporary, originalStr: cleanStr };
  }
  
  return { dateStr: null, isTemporary, originalStr: cleanStr };
}

/**
 * 解析任期时长（月数）
 */
function parseTermDuration(durationStr: string | number): number | null {
  if (!durationStr) return null;
  
  // 如果是数字，直接返回
  if (typeof durationStr === 'number') {
    return durationStr;
  }
  
  const cleanStr = String(durationStr).trim();
  
  // 匹配年
  const yearMatch = cleanStr.match(/(\d+)\s*年/);
  if (yearMatch) {
    return parseInt(yearMatch[1]) * 12;
  }
  
  // 匹配月
  const monthMatch = cleanStr.match(/(\d+)\s*(个?月)/);
  if (monthMatch) {
    return parseInt(monthMatch[1]);
  }
  
  // 纯数字
  const num = parseInt(cleanStr);
  if (!isNaN(num)) {
    return num;
  }
  
  return null;
}

// 导入干部数据 - 支持CSV和Excel格式，只要有姓名即可导入
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: '请选择文件' }, { status: 400 });
    }
    
    // 读取文件内容
    const buffer = await file.arrayBuffer();
    const fileName = file.name.toLowerCase();
    
    let rows: Array<Array<string | number | undefined>> = [];
    
    // 根据文件类型解析
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      // Excel文件
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      rows = jsonData as Array<Array<string | number | undefined>>;
    } else {
      // CSV/TXT文件
      const text = new TextDecoder().decode(buffer);
      const lines = text.split('\n').filter(line => line.trim());
      rows = lines.map(line => {
        return line.split(/[,，\t]/).map(cell => {
          let value = cell.trim().replace(/^["']|["']$/g, '');
          // 不要把包含中文或日期格式的字符串解析为数字
          // 检查是否包含中文、日期分隔符、或日期关键词
          if (/[年月日底暂定预计]/.test(value) || /^\d{4}[\/\-\.]\d{1,2}/.test(value)) {
            return value; // 保持字符串格式
          }
          // 尝试解析数字（但不能是年份格式）
          const num = parseFloat(value);
          if (!isNaN(num) && isFinite(num) && !/[/\-\.]/.test(value)) {
            return num;
          }
          return value;
        });
      });
    }
    
    if (rows.length < 2) {
      return NextResponse.json({ error: '文件内容为空或格式不正确，至少需要表头和一行数据' }, { status: 400 });
    }
    
    // 解析表头 - 清理Windows换行符
    const headers = rows[0].map(h => String(h || '').trim().replace(/\r/g, ''));
    console.log('=== 导入文件表头 ===');
    console.log('headers:', JSON.stringify(headers));
    console.log('====================');
    console.log('表头:', headers);
    
    // 映射字段名 - 扩展更多可能的列名
    const fieldMapping: Record<string, string> = {
      '姓名': 'name',
      '名称': 'name',
      '姓名 ': 'name', // 可能包含尾随空格
      '性别': 'gender',
      '出生年月日': 'birthDate',
      '出生日期': 'birthDate',
      '出生年月': 'birthDate',
      '生日': 'birthDate',
      '任职部门': 'department',
      '部门': 'department',
      '单位': 'department',
      '任职岗位': 'position',
      '岗位': 'position',
      '职务': 'position',
      '职位': 'position',
      '任期开始时间': 'termStartDate',
      '任期开始日期': 'termStartDate',
      '任期开始': 'termStartDate',
      '任职时间': 'termStartDate',
      '开始时间': 'termStartDate',
      '开始日期': 'termStartDate',
      '起任时间': 'termStartDate',
      '起任日期': 'termStartDate',
      '任期时长': 'termDuration',
      '任期': 'termDuration',
      '任期结束日期': 'termEndDate',
      '任期结束时间': 'termEndDate',
      '任期结束': 'termEndDate',
      '到期时间': 'termEndDate',
      '到期日期': 'termEndDate',
      '结束时间': 'termEndDate',
      '结束日期': 'termEndDate',
      '届满时间': 'termEndDate',
      '届满日期': 'termEndDate',
      '备注': 'remarks',
      '说明': 'remarks',
      '备注信息': 'remarks',
    };
    
    console.log('=== 字段映射表 ===');
    console.log('支持的列名:', Object.keys(fieldMapping).join(', '));
    console.log('==================');
    
    // 解析数据行
    const cadres: Array<Record<string, unknown>> = [];
    const warnings: string[] = [];
    let skippedCount = 0;
    
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      
      // 跳过完全空的行
      if (!values || values.every(v => !v)) continue;
      
      const row: Record<string, unknown> = {};
      let rowHasTemporary = false;
      
      headers.forEach((header, index) => {
        const field = fieldMapping[header];
        const cellValue = values[index];
        const valueStr = String(cellValue || '').trim().replace(/\r/g, '');
        
        if (!field || !valueStr) return;
        
        if (field === 'birthDate') {
          // 处理出生日期
          let dateStrInput = valueStr;
          // 只有Excel文件才处理数字格式的日期
          if (typeof cellValue === 'number' && (fileName.endsWith('.xlsx') || fileName.endsWith('.xls'))) {
            const excelDate = XLSX.SSF.parse_date_code(cellValue);
            if (excelDate) {
              dateStrInput = `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
            }
          }
          const { dateStr: parsedDate } = parseDateWithFlag(dateStrInput);
          if (parsedDate) {
            row[field] = parsedDate;
          } else {
            warnings.push(`第${i + 1}行: 无法解析出生日期 "${dateStrInput}"`);
          }
        } else if (field === 'termStartDate') {
          // 处理任期开始时间
          let dateStrInput = valueStr;
          if (typeof cellValue === 'number' && (fileName.endsWith('.xlsx') || fileName.endsWith('.xls'))) {
            const excelDate = XLSX.SSF.parse_date_code(cellValue);
            if (excelDate) {
              dateStrInput = `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
            }
          }
          const { dateStr: parsedDate } = parseDateWithFlag(dateStrInput);
          if (parsedDate) {
            row[field] = parsedDate;
          } else {
            warnings.push(`第${i + 1}行: 无法解析任期开始时间 "${dateStrInput}"`);
          }
        } else if (field === 'termEndDate') {
          // 处理任期结束时间（可能包含暂定标记）
          let dateStrInput = valueStr;
          if (typeof cellValue === 'number' && (fileName.endsWith('.xlsx') || fileName.endsWith('.xls'))) {
            const excelDate = XLSX.SSF.parse_date_code(cellValue);
            if (excelDate) {
              dateStrInput = `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
            }
          }
          const { dateStr: parsedDate, isTemporary: tempFlag, originalStr } = parseDateWithFlag(dateStrInput);
          if (parsedDate) {
            row[field] = parsedDate;
            if (tempFlag) {
              rowHasTemporary = true;
              // 保存原始完整信息到原始值字段（用于显示）
              row['termEndDateOriginal'] = originalStr;
            }
          } else {
            warnings.push(`第${i + 1}行: 无法解析任期结束时间 "${dateStrInput}"`);
          }
        } else if (field === 'termDuration') {
          const duration = parseTermDuration(cellValue as string | number);
          if (duration) {
            row[field] = duration;
          }
        } else {
          row[field] = valueStr;
        }
      });
      
      // 设置暂定标记
      if (rowHasTemporary) {
        row['isTemporary'] = true;
      }
      
      // 只验证姓名，其他字段都可以为空
      if (!row.name) {
        skippedCount++;
        continue;
      }
      
      // 调试日志：显示每一行的解析结果
      if (i <= 3) { // 只打印前几行
        console.log(`=== 第${i}行解析结果 ===`);
        console.log('姓名:', row.name);
        console.log('任期开始时间:', row.termStartDate);
        console.log('任期结束时间:', row.termEndDate);
        console.log('任期结束时间原始值:', row.termEndDateOriginal);
        console.log('isTemporary:', row.isTemporary);
        console.log('备注:', row.remarks);
        console.log('======================');
      }
      
      cadres.push(row);
    }
    
    if (cadres.length === 0) {
      return NextResponse.json({ 
        error: '没有有效的数据可导入，请确保至少有一行包含姓名',
        warnings: warnings.length > 0 ? warnings.slice(0, 10) : undefined
      }, { status: 400 });
    }
    
    const client = getSupabaseClient();
    
    // 清空原有数据
    const { error: deleteError } = await client
      .from('cadres')
      .delete()
      .neq('id', 0);
    
    if (deleteError) {
      console.error('Error clearing data:', deleteError);
    }
    
    // 处理并插入新数据
    const processedCadres = cadres.map(cadre => {
      const birthDate = cadre.birthDate as string | null;
      const termStartDate = cadre.termStartDate as string | null;
      const termDuration = cadre.termDuration as number | undefined;
      const termEndDate = cadre.termEndDate as string | undefined;
      const termEndDateOriginal = cadre.termEndDateOriginal as string | undefined;
      const isTemporary = cadre.isTemporary as boolean;
      
      let retirementDate: string | null = null;
      let finalEndDate: string | null = null;
      let status = '在任';
      
      // 计算退休日期
      if (birthDate) {
        const retirement = calculateRetirementDate(birthDate);
        retirementDate = dateToStr(retirement);
      }
      
      // 计算任期结束日期
      if (termEndDate) {
        // 如果有明确的任期结束日期，直接使用
        finalEndDate = termEndDate;
        status = calculateTermStatus(termEndDate);
      } else if (termStartDate && birthDate) {
        // 只有开始时间，需要计算结束时间
        const result = calculateFinalTermEndDate(
          termStartDate,
          termDuration || null,
          null,
          birthDate
        );
        finalEndDate = dateToStr(result.finalEndDate);
        status = calculateTermStatus(finalEndDate);
      }
      
      return {
        name: cadre.name as string,
        gender: (cadre.gender as string) || null,
        birth_date: birthDate || null,
        department: (cadre.department as string) || null,
        position: (cadre.position as string) || null,
        term_start_date: termStartDate || null,
        term_duration: termDuration || null,
        term_end_date: finalEndDate,
        term_end_date_original: termEndDateOriginal || null,
        retirement_date: retirementDate,
        status,
        remarks: (cadre.remarks as string) || null,
        is_temporary: isTemporary || false,
      };
    });
    
    const { data, error: insertError } = await client
      .from('cadres')
      .insert(processedCadres)
      .select();
    
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    
    return NextResponse.json({ 
      message: `成功导入 ${data?.length || 0} 条数据${skippedCount > 0 ? `，跳过 ${skippedCount} 条无姓名记录` : ''}`,
      importedCount: data?.length || 0,
      skippedCount,
      warnings: warnings.length > 0 ? warnings.slice(0, 10) : undefined,
      headers: headers, // 返回解析到的表头
    });
  } catch (error) {
    console.error('Error importing cadres:', error);
    return NextResponse.json(
      { error: '导入数据失败: ' + (error instanceof Error ? error.message : '未知错误') },
      { status: 500 }
    );
  }
}
