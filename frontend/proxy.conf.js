const nodes = [
  'http://localhost:8081'
  // 'http://localhost:8082'
  // 'http://localhost:8083'
];

let currentIndex = 0;

const PROXY_CONFIG = {
  "/excelpro-service": {
    "target": nodes[0], // Phải có target mặc định
    "router": () => {
      // Mỗi lần có request, lấy node tiếp theo
      const target = nodes[currentIndex];
process.stdout.write(`\n--- [PROXY] Đang chuyển hướng tới: ${target} ---\n`);      
      currentIndex = (currentIndex + 1) % nodes.length;
      return target;
    },
    "changeOrigin": true,
    "logLevel": "debug",
    "onProxyReq": (proxyReq, req, res) => {
      // Log để chắc chắn request đã đi qua proxy
      console.log('Đang gửi request tới:', proxyReq.path);
    }
  }
};

module.exports = PROXY_CONFIG;