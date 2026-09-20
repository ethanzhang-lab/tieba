"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 钉钉推送调试脚本
 * 使用模拟的签到数据验证通知推送逻辑（尤其是钉钉 Webhook），
 * 不会请求贴吧接口、不会产生真实签到，可放心反复运行。
 */
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const notify_1 = require("./notify");
const dataProcessor_1 = require("./dataProcessor");
// 构造模拟签到结果，覆盖「新签到 / 已签到 / 失败 / 重试成功」四种情况
const mockSummary = {
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
(() => __awaiter(void 0, void 0, void 0, function* () {
    const summaryText = (0, dataProcessor_1.formatSummary)(mockSummary);
    console.log('---------------- 即将推送的内容 ----------------');
    console.log(summaryText);
    console.log('-----------------------------------------------');
    console.log(`📨 通知标题: ${(0, notify_1.getNotifyTitle)()}`);
    // 调试时强制打开通知开关
    if (process.env.ENABLE_NOTIFY !== 'true') {
        console.log('ℹ️ 检测到 ENABLE_NOTIFY 非 true，调试脚本将临时启用通知');
        process.env.ENABLE_NOTIFY = 'true';
    }
    const anySuccess = yield (0, notify_1.sendNotification)(summaryText);
    if (anySuccess) {
        console.log('✅ 调试推送完成，请检查钉钉群是否收到消息');
    }
    else {
        console.log('⚠️ 没有任何通知发送成功，请检查 .env 中的 DINGTALK_WEBHOOK / DINGTALK_SECRET 配置');
    }
}))();
