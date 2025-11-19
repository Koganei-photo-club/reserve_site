document.addEventListener("DOMContentLoaded", () => {
  console.log("Root index.js loaded");
});

/***********************
 * ヘッダー/ナビの出し入れ
 ***********************/
let lastScrollY = window.scrollY;
const header = document.getElementById("main-header");
const navbar = document.querySelector(".navbar");

window.addEventListener("scroll", () => {
  const scrollTop = window.scrollY;
  const windowHeight = window.innerHeight;
  const docHeight = document.documentElement.scrollHeight;

  if (scrollTop <= 0) {
    header.style.top = "0";
    navbar.style.top = "70px";
  } else if (scrollTop + windowHeight >= docHeight) {
    header.style.top = "-70px";
    navbar.style.top = "0";
  } else if (scrollTop > lastScrollY) {
    header.style.top = "-70px";
    navbar.style.top = "0";
  } else {
    header.style.top = "0";
    navbar.style.top = "70px";
  }
  lastScrollY = scrollTop;
});


/***********************
 * Instagram ポップアップ
 ***********************/
document.addEventListener("DOMContentLoaded", function() {
  const instaIcons = document.querySelectorAll(".insta-icon");
  if (!instaIcons.length) return;

  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";
  overlay.innerHTML = `
    <div class="popup-content">
      <p>Instagramアカウントを表示しますか？</p>
      <div class="popup-buttons">
        <button class="confirm">表示する</button>
        <button class="cancel">閉じる</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const confirmBtn = overlay.querySelector(".confirm");
  const cancelBtn = overlay.querySelector(".cancel");
  let currentURL = null;

  instaIcons.forEach(icon => {
    const parent = icon.closest(".work-author");
    const url = parent?.dataset.instagram;
    if (!url) return;

    icon.addEventListener("click", (e) => {
      e.stopPropagation();
      currentURL = url;
      overlay.style.display = "flex";
    });
  });

  confirmBtn.addEventListener("click", () => {
    if (currentURL) window.open(currentURL, "_blank");
    overlay.style.display = "none";
  });
  cancelBtn.addEventListener("click", () => overlay.style.display = "none");
  overlay.addEventListener("click", e => {
    if (e.target === overlay) overlay.style.display = "none";
  });
});


/***********************************
 * 「もっと見る」折りたたみ（滑らかアニメ版）
 ***********************************/
function setupCollapsibles() {
  const descriptions = document.querySelectorAll(".work-description");

  descriptions.forEach(desc => {
    const button = desc.nextElementSibling;
    if (!button || !button.classList.contains("toggle-desc")) return;

    // 空テキストの場合はボタン非表示
    const plain = desc.textContent.replace(/\s+/g, "");
    if (!plain) { button.style.display = "none"; return; }

    // 5行分の高さを算出
    const lineHeight = parseFloat(getComputedStyle(desc).lineHeight) || 18;
    const collapsed = Math.round(lineHeight * 5);

    // いったん自動サイズにして全文高さ測定
    const prevMax = desc.style.maxHeight;
    desc.style.maxHeight = "none";
    const full = desc.scrollHeight;
    // 初期は折りたたみサイズに戻す
    desc.style.maxHeight = collapsed + "px";
    desc.style.overflow = "hidden";

    // 短文ならボタン不要
    if (full <= collapsed + 2) {
      button.style.display = "none";
      return;
    }

    let animating = false;

    const expand = () => {
      if (animating) return;
      animating = true;
      // 一度autoにして実寸取得 → px指定してアニメ
      desc.style.maxHeight = "none";
      const target = desc.scrollHeight;
      desc.style.maxHeight = collapsed + "px";
      requestAnimationFrame(() => {
        desc.style.maxHeight = target + "px";
        button.textContent = "閉じる";
      });
      // アニメ終了後に auto に戻すと折返しにも強い
      setTimeout(() => {
        desc.style.maxHeight = "none";
        animating = false;
      }, 550);
    };

    const collapse = () => {
      if (animating) return;
      animating = true;
      // 現在の実寸をpxで固定してから縮める
      desc.style.maxHeight = desc.scrollHeight + "px";
      requestAnimationFrame(() => {
        desc.style.maxHeight = collapsed + "px";
        button.textContent = "もっと見る";
      });
      setTimeout(() => { animating = false; }, 550);
    };

    let expanded = false;
    button.addEventListener("click", () => {
      expanded ? collapse() : expand();
      expanded = !expanded;
    });
  });
}

window.addEventListener("load", setupCollapsibles);


/***********************************
 * 画像：保存抑止 + Lightbox + ピンチズーム
 ***********************************/

// 右クリック・ドラッグ・選択の基本抑止（ページ全体）
document.addEventListener("contextmenu", e => e.preventDefault());
document.addEventListener("dragstart", e => e.preventDefault());
document.addEventListener("selectstart", e => e.preventDefault());

// Lightbox生成（1回）
document.addEventListener("DOMContentLoaded", () => {
  const lightbox = document.createElement("div");
  lightbox.className = "lightbox";
  const img = document.createElement("img");
  lightbox.appendChild(img);
  document.body.appendChild(lightbox);

  // 開く（PCクリック/スマホタップどちらもOK）
  document.querySelectorAll(".photo-wrapper").forEach(wrapper => {
    const open = () => {
      const url = wrapper.dataset.full;
      if (!url) return;
      img.src = url;
      img.style.transform = "scale(1)";
      lightbox.classList.add("active");
    };
    wrapper.addEventListener("click", open);
    wrapper.addEventListener("touchend", open, { passive: true });
  });

  // 背景クリックで閉じる
  lightbox.addEventListener("click", e => {
    if (e.target === lightbox) lightbox.classList.remove("active");
  });

  // ピンチズーム（1〜3倍）
  let initialDistance = 0;
  let currentScale = 1;

  lightbox.addEventListener("touchstart", e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const [t1, t2] = e.touches;
      initialDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    }
  }, { passive: false });

  lightbox.addEventListener("touchmove", e => {
    if (e.touches.length === 2 && initialDistance > 0) {
      e.preventDefault();
      const [t1, t2] = e.touches;
      const newDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const scale = Math.min(Math.max(newDistance / initialDistance, 1), 3);
      currentScale = scale;
      img.style.transform = `scale(${scale})`;
    }
  }, { passive: false });

  lightbox.addEventListener("touchend", () => {
    if (currentScale < 1.05) img.style.transform = "scale(1)";
    initialDistance = 0;
  });
});

/**********************************************
 * 📱 アプリ風ページ遷移（フェードアニメーション）
 **********************************************/
document.querySelectorAll("a").forEach(a => {
  // 外部リンク・#アンカー・新規タブは除外
  const href = a.getAttribute("href");
  if (!href || href.startsWith("http") || href.startsWith("#") || a.target === "_blank") return;

  a.addEventListener("click", (e) => {
    e.preventDefault();        // 通常遷移を止める
    const url = href;

    // フェードアウト開始
    document.body.classList.add("fade-out");

    setTimeout(() => {
      window.location.href = url;
    }, 350);   // ← CSSの0.35sと同期
  });
});