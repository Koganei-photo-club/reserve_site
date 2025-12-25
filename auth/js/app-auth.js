// auth/app-auth.js

// 利用者管理用 GAS Web API
const USER_API =
  "https://script.google.com/macros/s/AKfycbxWNWz8aIr_8DqTTHsk9y089ZLZO6B8m2ywd6e1kCWi6Fyhr4AIOcS5QwdXpHxjx8w/exec";


  const DEMO_MODE = false;  // ← 動画撮影中は true、本番は false

  /**
 * Google Identity Services のコールバック
 * index.html の data-callback="handleCredentialResponse" から呼ばれる
 */
async function handleCredentialResponse(response) {
  try {
    const idToken = response.credential;

    const res = await fetch(USER_API, {
      method: "POST",
      // headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    });

    const data = await res.json();

    if (!DEMO_MODE) {
      if (data.result === "forbidden") {
        alert("⚠ 大学アカウント（@stu.hosei.ac.jp）のみ利用できます。");
        return;
      }
    }

    if (data.result === "register-required") {
      // 初回登録が必要
      sessionStorage.setItem("email", data.email);
      window.location.href = "register.html";
      return;
    }

    if (data.result === "ok") {
      // 既存ユーザー → user 情報を保存してマイページへ
      sessionStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = "../mypage.html";
      return;
    }

    // 想定外
    console.error("Unexpected response:", data);
    alert("ログイン処理でエラーが発生しました。時間をおいて再試行してください。");

  } catch (err) {
    console.error(err);
    alert("通信エラーが発生しました。ネットワークを確認してください。");
  }
};