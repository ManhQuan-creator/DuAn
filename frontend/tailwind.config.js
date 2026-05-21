/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{html,ts,scss}',
  ],
  theme: {
    extend: {},
  },
  // Tắt preflight để tránh đè reset của Taiga UI / AG Grid.
  // Kích hoạt lại nếu sau này muốn Tailwind quản toàn bộ base styles.
  corePlugins: {
    preflight: false,
  },
  plugins: [],
};
