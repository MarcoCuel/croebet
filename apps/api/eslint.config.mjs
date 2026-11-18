import tseslint from "typescript-eslint";

const config = [
  ...tseslint.configs.recommended,
  { ignores: ["dist/**", "drizzle/**"] },
];
export default config;
