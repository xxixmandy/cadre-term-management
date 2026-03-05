import { Cadre } from "@/storage/database/shared/schema";

/**
 * 计算退休日期（根据出生日期，默认60岁退休）
 */
export function calculateRetirementDate(birthDate: Date | string): Date {
  let birth: Date;
  if (typeof birthDate === 'string') {
    const match = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      birth = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    } else {
      birth = new Date(birthDate);
    }
  } else {
    birth = birthDate;
  }
  const retirement = new Date(birth);
  retirement.setFullYear(retirement.getFullYear() + 60);
  return retirement;
}

/**
 * 根据任期时长计算任期结束日期
 */
export function calculateTermEndDate(startDate: Date | string, durationMonths: number): Date {
  let start: Date;
  if (typeof startDate === 'string') {
    const match = startDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      start = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    } else {
      start = new Date(startDate);
    }
  } else {
    start = startDate;
  }
  const end = new Date(start);
  end.setMonth(end.getMonth() + durationMonths);
  return end;
}

/**
 * 计算任期状态
 * @param termEndDate 任期结束日期
 * @returns '在任' | '即将到期' | '已到期'
 */
export function calculateTermStatus(termEndDate: Date | string | null): string {
  if (!termEndDate) return '在任';
  
  // 解析日期字符串，避免时区问题
  let end: Date;
  if (typeof termEndDate === 'string') {
    const match = termEndDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      end = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]), 23, 59, 59, 999);
    } else {
      end = new Date(termEndDate);
      end.setHours(23, 59, 59, 999);
    }
  } else {
    end = termEndDate;
    end.setHours(23, 59, 59, 999);
  }
  
  const now = new Date();
  
  if (now > end) {
    return '已到期';
  }
  
  // 计算距离结束日期的天数
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 30) {
    return '即将到期';
  }
  
  return '在任';
}

/**
 * 自动计算任期结束时间（综合考虑退休时间）
 */
export function calculateFinalTermEndDate(
  termStartDate: Date | string,
  termDuration: number | null,
  termEndDate: Date | string | null,
  birthDate: Date | string
): { finalEndDate: Date; isLimited: boolean } {
  // 解析开始日期
  let start: Date;
  if (typeof termStartDate === 'string') {
    const match = termStartDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      start = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    } else {
      start = new Date(termStartDate);
    }
  } else {
    start = termStartDate;
  }
  
  const retirement = calculateRetirementDate(birthDate);
  
  let calculatedEndDate: Date;
  
  if (termEndDate) {
    // 如果有明确的任期结束日期，优先使用
    if (typeof termEndDate === 'string') {
      const match = termEndDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) {
        calculatedEndDate = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      } else {
        calculatedEndDate = new Date(termEndDate);
      }
    } else {
      calculatedEndDate = termEndDate;
    }
  } else if (termDuration) {
    // 根据任期时长计算
    calculatedEndDate = calculateTermEndDate(start, termDuration);
  } else {
    // 默认任期5年
    calculatedEndDate = calculateTermEndDate(start, 60);
  }
  
  // 如果退休日期早于任期结束日期，则使用退休日期
  if (retirement < calculatedEndDate) {
    return { finalEndDate: retirement, isLimited: true };
  }
  
  return { finalEndDate: calculatedEndDate, isLimited: false };
}

/**
 * 解析多种格式的日期
 */
export function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // 清理字符串
  const cleanStr = dateStr.trim();
  
  // 检查是否为暂定时间
  const isTemporary = cleanStr.includes('暂定') || cleanStr.includes('预计');
  
  // 提取日期部分
  let datePart = cleanStr
    .replace(/暂定|预计|左右|前/g, '')
    .trim();
  
  // 尝试多种日期格式
  const formats = [
    /^(\d{4})年(\d{1,2})月(\d{1,2})日?$/,      // 2024年1月1日
    /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/,     // 2024-01-01 或 2024/01/01
    /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/,         // 2024.01.01
    /^(\d{4})年(\d{1,2})月$/,                   // 2024年1月（只有年月）
    /^(\d{4})[/-](\d{1,2})$/,                   // 2024-01（只有年月）
  ];
  
  for (const format of formats) {
    const match = datePart.match(format);
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      const day = match[3] ? parseInt(match[3]) : 1;
      
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        return new Date(year, month - 1, day);
      }
    }
  }
  
  // 尝试直接解析
  const parsed = new Date(datePart);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  
  return null;
}

/**
 * 解析任期时长（月数）
 */
export function parseTermDuration(durationStr: string): number | null {
  if (!durationStr) return null;
  
  const cleanStr = durationStr.trim();
  
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
  
  return null;
}

/**
 * 格式化日期显示 - 直接从字符串解析，避免时区问题
 */
export function formatDate(date: Date | string | null): string {
  if (!date) return '-';
  
  // 如果是字符串，直接解析避免时区问题
  if (typeof date === 'string') {
    // 支持 YYYY-MM-DD 格式
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return `${parseInt(match[1])}年${parseInt(match[2])}月${parseInt(match[3])}日`;
    }
    // 尝试其他格式
    const d = new Date(date);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    }
    return '-';
  }
  
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * 计算距离到期还有多少天
 */
export function getDaysUntilExpiry(termEndDate: Date | string | null): number | null {
  if (!termEndDate) return null;
  
  let end: Date;
  if (typeof termEndDate === 'string') {
    const match = termEndDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      end = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    } else {
      end = new Date(termEndDate);
    }
  } else {
    end = termEndDate;
  }
  
  const now = new Date();
  
  // 重置时间到当天开始
  now.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  const diffTime = end.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 判断是否需要发送提醒
 * @param daysUntilExpiry 距离到期天数
 * @returns 需要提醒的时间点
 */
export function shouldNotify(daysUntilExpiry: number | null): { shouldNotify: boolean; notifyType: string } {
  if (daysUntilExpiry === null) return { shouldNotify: false, notifyType: '' };
  
  if (daysUntilExpiry === 1) {
    return { shouldNotify: true, notifyType: '明天到期' };
  }
  if (daysUntilExpiry <= 15 && daysUntilExpiry > 1) {
    return { shouldNotify: true, notifyType: '半个月内到期' };
  }
  if (daysUntilExpiry <= 60 && daysUntilExpiry > 30) {
    return { shouldNotify: true, notifyType: '两个月内到期' };
  }
  
  return { shouldNotify: false, notifyType: '' };
}
