// 한 해 가계부 설정
// Supabase 대시보드 → Project Settings → API 에서 값을 복사해 넣으세요.
// anon(public) 키는 브라우저에 공개돼도 괜찮은 키예요. 데이터는 행 수준 보안(RLS)으로 보호돼요.
// service_role 키나 Anthropic API 키는 절대 여기에 넣지 마세요.
window.APP_CONFIG = {
  SUPABASE_URL: "https://YOUR_PROJECT_REF.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",
  AI_ENABLED: false  // true로 바꾸면 말로 입력의 AI 정리와 월간 리포트가 켜져요 (서버 함수 배포 필요)
};
