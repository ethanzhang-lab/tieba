/**
 * 钉钉推送调试脚本
 * 使用模拟的签到数据验证通知推送逻辑（尤其是钉钉 Webhook），
 * 不会请求贴吧接口、不会产生真实签到，可放心反复运行。
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { sendNotification, getNotifyTitle } from './notify';
import { formatSummary } from './dataProcessor';
import { SignResultSummary } from './types/dataProcessor.types';

// 构造模拟签到结果，覆盖「新签到 / 已签到 / 失败 / 重试成功」四种情况
const mockSummary: SignResultSummary = {
  totalCount: 4,
  successCount: 2,
  alreadySignedCount: 1,
  failedCount: 1,
  signResults: {
    success: [
      {
        success: true,
        message: '签到成功',
        name: '柯南',
        index: 1,
        info: { rank: 123, continueCount: 15 }
      },
      {
        success: true,
        message: '已经签到过了',
        name: '海贼王',
        index: 2,
        info: {}
      },
      {
        success: true,
        message: '签到成功',
        name: '进击的巨人',
        index: 4,
        retried: true,
        retryCount: 1,
        info: { rank: 456, continueCount: 3 }
      }
    ],
    failed: [
      {
        success: false,
        message: '签到失败，需要验证码',
        name: '火影忍者',
        index: 3,
        info: { code: 2150040 }
      }
    ]
  }
};

(async () => {
  const summaryText = formatSummary(mockSummary);

  console.log('---------------- 即将推送的内容 ----------------');
  console.log(summaryText);
  console.log('-----------------------------------------------');
  console.log(`📨 通知标题: ${getNotifyTitle()}`);

  // 调试时强制打开通知开关
  if (process.env.ENABLE_NOTIFY !== 'true') {
    console.log('ℹ️ 检测到 ENABLE_NOTIFY 非 true，调试脚本将临时启用通知');
    process.env.ENABLE_NOTIFY = 'true';
  }

  const anySuccess = await sendNotification(summaryText);

  if (anySuccess) {
    console.log('✅ 调试推送完成，请检查钉钉群是否收到消息');
  } else {
    console.log('⚠️ 没有任何通知发送成功，请检查 .env 中的 DINGTALK_WEBHOOK / DINGTALK_SECRET 配置');
  }
})();
