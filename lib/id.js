// 使用 ES Module 导出（Manifest V3 支持 <script type="module"> 方式加载）
export function generateId() {
    // 创建一个长度为 16 字节的无符号整型数组，用作随机源（共 128 位）
    const bytes = new Uint8Array(16);
    // 调用 Web Crypto API 生成高质量随机数
    crypto.getRandomValues(bytes);
    // 将每个字节转换为两位十六进制字符串，不足两位左侧补 0
    const hexParts = Array.from(bytes, b => b.toString(16).padStart(2, '0'));
    // 连接得到 32 位十六进制字符串，作为全局唯一 ID（无分隔符）
    const hex = hexParts.join('');
    // 返回 ID 字符串，例如 "3fa85f6457174562b3fc2c963f66afa6"
    return hex;
  }
  