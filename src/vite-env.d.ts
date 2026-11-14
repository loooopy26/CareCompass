/// <reference types="vite/client" />

// .env 값 (VITE_로 시작하는 값만 번들에 들어감)
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_COGNITO_USER_POOL_ID?: string;
  readonly VITE_COGNITO_CLIENT_ID?: string;
  readonly VITE_COGNITO_REGION?: string;
}
