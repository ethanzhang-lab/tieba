/**
 * 数据处理模块
 */
import { 
  ProcessedSignResult, 
  SignResultItem, 
  SignResultSummary 
} from './types/dataProcessor.types';
import { SignResult } from './types/apiService.types';

/**
 * 处理签到结果数据
 * @param signResult - 签到结果
 * @returns 处理后的签到结果
 */
export function processSignResult(signResult: SignResult): ProcessedSignResult {
  // 解析签到结果
  if (!signResult) {
    return { success: false, message: '签到结果为空', info: {} };
  }
  
  // 处理不同的成功状态码
  if (signResult.no === 0 && signResult.data?.errmsg === 'success' && signResult.data?.errno === 0) {
    return { 
      success: true, 
      message: '签到成功', 
      info: {
        rank: signResult.data?.uinfo?.user_sign_rank,
        continueCount: signResult.data?.uinfo?.cont_sign_num 
      }
    };
  } else if (signResult.no === 1101) {
    return {
      success: true,
      message: '已经签到过了',
      info: {}
    };
  } else if (signResult.no === 2150040) {
    return {
      success: false,
      message: '签到失败，需要验证码',
      info: { code: signResult.no }
    };
  } else if (signResult.no === 1011) {
    return {
      success: false,
      message: '未加入此吧或等级不够',
      info: { code: signResult.no }
    };
  } else if (signResult.no === 1102) {
    return {
      success: false,
      message: '签到过快',
      info: { code: signResult.no }
    };
  } else if (signResult.no === 1010) {
    return {
      success: false,
      message: '目录出错',
      info: { code: signResult.no }
    };
  } else {
    return {
      success: false,
      message: signResult.error || `签到失败，错误码: ${signResult.no || '未知'}`,
      info: { 
        code: signResult.no ?? -1,
        data: signResult.data 
      }
    };
  }
}

interface SummaryStats {
  total: number;
  success: number;
  alreadySigned: number;
  failed: number;
  errorMessages: Record<string, number>;
  signResults?: {
    success: SignResultItem[];
    failed: SignResultItem[];
  };
}

/**
 * 汇总签到结果
 * @param results - 所有贴吧的签到结果
 * @returns 汇总结果
 */
export function summarizeResults(results: SignResultItem[]): SignResultSummary {
  if (!results || !Array.isArray(results)) {
    return {
      totalCount: 0,
      successCount: 0,
      alreadySignedCount: 0,
      failedCount: 0,
      signResults: {
        success: [],
        failed: []
      }
    };
  }
  
  const summary: SignResultSummary = {
    totalCount: results.length,
    successCount: 0,
    alreadySignedCount: 0,
    failedCount: 0,
    signResults: {
      success: [],
      failed: []
    }
  };
  
  // 统计各种错误类型的数量
  results.forEach(result => {
    if (result.success) {
      if (result.message === '已经签到过了') {
        summary.alreadySignedCount += 1;
        summary.signResults.success.push(result);
      } else {
        summary.successCount += 1;
        summary.signResults.success.push(result);
      }
    } else {
      summary.failedCount += 1;
      summary.signResults.failed.push(result);
    }
  });
  
  return summary;
}

/**
 * 格式化汇总结果为文本
 * @param summary - 汇总结果
 * @returns 格式化后的文本
 */
export function formatSummary(summary: SignResultSummary): string {
  let text = `📊 签到统计:\n`;
  text += `总计: ${summary.totalCount} 个贴吧\n`;
  text += `✅ 成功: ${summary.successCount} 个\n`;
  text += `📌 已签: ${summary.alreadySignedCount} 个\n`;
  text += `❌ 失败: ${summary.failedCount} 个`;
  
  // 添加失败原因统计
  if (summary.failedCount > 0) {
    // 整理失败原因
    const errorMessageCount: Record<string, number> = {};
    summary.signResults.failed.forEach(item => {
      if (!errorMessageCount[item.message]) {
        errorMessageCount[item.message] = 1;
      } else {
        errorMessageCount[item.message]++;
      }
    });
    
    text += `\n\n❌ 失败原因:\n`;
    for (const [errorMessage, count] of Object.entries(errorMessageCount)) {
      text += `- ${errorMessage}: ${count} 个\n`;
    }
  }
  
  // 追加逐条签到明细
  text += formatDetails(summary);
  
  return text;
}

/**
 * 格式化签到明细 - 逐条列出每个贴吧的签到状态
 * @param summary - 汇总结果
 * @returns 格式化后的明细文本（无数据时返回空字符串）
 */
export function formatDetails(summary: SignResultSummary): string {
  const successResults = summary.signResults.success;
  const failedResults = summary.signResults.failed;
  
  if (successResults.length === 0 && failedResults.length === 0) {
    return '';
  }
  
  // 按原始索引排序，保持与贴吧列表一致的顺序
  const allResults = [...successResults, ...failedResults]
    .sort((a, b) => (a.index || 0) - (b.index || 0));
  
  let text = `\n\n📋 签到明细 (共 ${allResults.length} 个):\n`;
  
  allResults.forEach(item => {
    // 图标区分：新签到 ✅ / 已签到 📌 / 失败 ❌
    const icon = item.success
      ? (item.message === '已经签到过了' ? '📌' : '✅')
      : '❌';
    
    // 组装排名、连续签到天数等附加信息
    const extraParts: string[] = [];
    if (item.info?.rank !== undefined && item.info?.rank !== null && item.info?.rank !== '') {
      extraParts.push(`排名 ${item.info.rank}`);
    }
    if (item.info?.continueCount !== undefined && item.info?.continueCount !== null && item.info?.continueCount !== '') {
      extraParts.push(`连续 ${item.info.continueCount} 天`);
    }
    const extra = extraParts.length > 0 ? ` - ${extraParts.join('，')}` : '';
    
    // 失败项附带失败原因；重试成功的加以标注
    const retryTag = item.retried ? ' (重试成功)' : '';
    const reason = item.success ? '' : ` - ${item.message}`;
    
    text += `${icon} ${item.index}. ${item.name}${extra}${retryTag}${reason}\n`;
  });
  
  return text;
} 