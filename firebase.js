// --- 1. Firebase 초기화 설정 ---
const firebaseConfig = {
  apiKey: "AIzaSyAzDc8nErqYcYYy-itp2Tk9WZExy3PBlIU",
  authDomain: "battleship-f08f8.firebaseapp.com",
  databaseURL: "https://battleship-f08f8-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "battleship-f08f8",
  storageBucket: "battleship-f08f8.firebasestorage.app",
  messagingSenderId: "1146329001",
  appId: "1:1146329001:web:f2d698e5661582ee1f96b8"
};

// Firebase 앱 인스턴스 초기화
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// --- 2. 점수 등록 함수 (Push) ---
// /3minrank/{diff} 경로에 3자리 이니셜, 점수, 캐릭터, 타임스탬프 저장
async function saveScoreToFirebase(diff, initials, score, heroChar) {
  try {
    const cleanInitials = (initials || 'AAA').substring(0, 3).toUpperCase();
    const rankRef = db.ref(`3minrank/${diff}`);
    
    await rankRef.push({
      initials: cleanInitials,
      score: Number(score),
      char: heroChar,
      timestamp: Date.now()
    });
    return true;
  } catch (err) {
    console.error("Firebase 점수 저장 실패:", err);
    return false;
  }
}

// --- 3. 난이도별 상위 3위 데이터 실시간 쿼리 함수 ---
async function fetchTop3ByDiff(diff) {
  try {
    const rankRef = db.ref(`3minrank/${diff}`);
    // score 기준 오름차순으로 상위 3개 쿼리
    const snapshot = await rankRef.orderByChild('score').limitToLast(3).once('value');
    
    let list = [];
    snapshot.forEach(child => {
      list.push(child.val());
    });

    // 최고점이 1위가 되도록 내림차순 정렬
    list.sort((a, b) => b.score - a.score);
    return list;
  } catch (err) {
    console.error(`Firebase ${diff} 랭킹 불러오기 실패:`, err);
    return [];
  }
}

// --- 4. TOP 3 진입 자격 검증 함수 ---
// 플레이어 점수가 해당 난이도 3위 안에 드는지 체크
async function checkTop3Eligibility(diff, currentScore) {
  try {
    const top3 = await fetchTop3ByDiff(diff);
    // 등록된 기록이 3개 미만이면 무조건 입성
    if (top3.length < 3) return true;
    // 3위 점수보다 현재 점수가 높으면 입성
    const lowestTopScore = top3[top3.length - 1].score;
    return currentScore > lowestTopScore;
  } catch (err) {
    console.error("TOP 3 검증 실패:", err);
    return true; // 오류 시 일단 입력 허용
  }
}

// --- 5. 명예의 전당 모달 UI 렌더링 함수 ---
async function loadLeaderboard() {
  const diffs = ['easy', 'normal', 'hard'];
  const medals = ['🥇', '🥈', '🥉'];
  const heroIcons = { warrior: '🥷', mage: '🧙', archer: '🧝' };

  for (const diff of diffs) {
    const container = document.getElementById(`podium-${diff}`);
    if (!container) continue;
    container.innerHTML = '<div style="color:#aaa; text-align:center;">로딩 중...</div>';

    const top3 = await fetchTop3ByDiff(diff);

    if (top3.length === 0) {
      container.innerHTML = '<div style="color:#666; text-align:center; padding:15px 0;">기록 없음</div>';
      continue;
    }

    let html = '';
    top3.forEach((item, index) => {
      const medal = medals[index] || `${index + 1}위`;
      const icon = heroIcons[item.char] || '⚔️';
      const formattedScore = Number(item.score).toLocaleString();

      html += `
        <div class="podium-item">
          <span>${medal} <b>${item.initials}</b> ${icon}</span>
          <span style="color:#ffcc00; font-weight:bold;">${formattedScore} P</span>
        </div>
      `;
    });

    container.innerHTML = html;
  }
}

// 글로벌 네임스페이스 바인딩 (game.js 및 HTML에서 직접 호출)
window.saveScoreToFirebase = saveScoreToFirebase;
window.fetchTop3ByDiff = fetchTop3ByDiff;
window.checkTop3Eligibility = checkTop3Eligibility;
window.loadLeaderboard = loadLeaderboard;
