// auth/app-auth.js

// 利用者管理用 GAS Web API
const USER_API =
  "https://script.google.com/macros/s/AKfycbyfpetIsPVKur5FnHpqk24Lu7bJ58o8z-nmNo8aPy0mCXU849psXIgL4x36RevcbQ/exec";

/**
 * Google Identity Services のコールバック
 * index.html の data-callback="handleCredentialResponse" から呼ばれる
 */
async function handleCredentialResponse(response) {
  try {
    const idToken = response.credential;

    const res = await fetch(USER_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    });

    const data = await res.json();

    if (data.result === "forbidden") {
      alert("⚠ 大学アカウント（@stu.hosei.ac.jp）のみ利用できます。");
      return;
    }

    if (data.result === "register-required") {
      // 初回登録が必要
      sessionStorage.setItem("email", data.email);
      window.location.href = "/auth/register.html";
      return;
    }

    if (data.result === "ok") {
      // 既存ユーザー → user 情報を保存してマイページへ
      sessionStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = "/mypage.html";
      return;
    }

    // 想定外
    console.error("Unexpected response:", data);
    alert("ログイン処理でエラーが発生しました。時間をおいて再試行してください。");

  } catch (err) {
    console.error(err);
    alert("通信エラーが発生しました。ネットワークを確認してください。");
  }
}