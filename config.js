// 이 파일은 public 저장소에 올라가므로 "공개 가능한 값"만 둡니다.
// 비밀 키(관리자 키 / 결제 시크릿 키)는 절대 여기에 넣지 않습니다.

const SUPABASE_URL = "https://snwjhxjntrqetguuozwq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_APLbu38fBjKBgJkKnPU1tA_dEhAYgEo";

// 토스페이먼츠 결제위젯 클라이언트 키.
// 클라이언트 키는 브라우저에 노출되도록 만들어진 값이라 공개해도 됩니다.
// 지금은 토스가 문서에 공개한 테스트 키를 쓰고 있습니다.
// 본인 키로 바꾸려면 이 값과 함께 Edge Function 의 TOSS_SECRET_KEY 도 같은 세트로 바꿔야 합니다.
const TOSS_CLIENT_KEY = "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";
