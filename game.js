// =============================================================================
// [도전! 3분 용사] 최종 통합 게임 엔진 (game.js)
// =============================================================================

// --- 1. 에셋 로더 (이미지 부재 시 이모티콘 Fallback 자동 적용) ---
const ASSETS = {
  images: {},
  load(key, src) {
    const img = new Image();
    img.src = src;
    img.onload = () => { ASSETS.images[key] = img; };
    img.onerror = () => { ASSETS.images[key] = null; };
  }
};

// 깃허브 에셋 경로 등록
ASSETS.load('hero_warrior', 'assets/heroes/warrior.gif');
ASSETS.load('hero_mage', 'assets/heroes/mage.gif');
ASSETS.load('hero_archer', 'assets/heroes/archer.gif');

ASSETS.load('mob_ghost', 'assets/monsters/ghost.gif');
ASSETS.load('mob_zombie', 'assets/monsters/zombie.gif');
ASSETS.load('mob_skeleton', 'assets/monsters/skeleton.gif');
ASSETS.load('boss_dragon', 'assets/monsters/dragon.gif');
ASSETS.load('boss_demon', 'assets/monsters/demon.gif');

ASSETS.load('effect_fireball', 'assets/effects/fire_ball.gif');
ASSETS.load('effect_darkorb', 'assets/effects/dark_orb.gif');

// 버프 카드 및 HUD 트레이용 9종 아이콘 PNG 로드
['heal', 'shield', 'speed', 'sharp', 'atk_up', 'cd_down', 'score_copy', 'max_hp', 'time'].forEach(id => {
  ASSETS.load('icon_' + id, `assets/icons/${id}.png`);
});

// --- 2. 캔버스 및 전역 상태 ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let gameState = 'TITLE'; // TITLE, READY, PLAYING, UPGRADE, RESULT
let selectedChar = null;
let selectedDiff = null;

let timeLeft = 180;
let score = 0;
let lastUpgradeScore = 0;
let pendingUpgrades = 0;
let readyTimer = 0;
let warningTimer = 0;

const STAGE_LENGTH = 1500; // 총 거리(m)
const SCALE_X = 10;        // 1m = 10px

const FLOOR_1_Y = 430;     // 1층 바닥
const FLOOR_2_Y = 320;     // 2층 발판 (차이 110px)

let cameraX = 0;
let lastDistanceSpawn = 0;

// 레트로 화면 흔들림 (Screen Shake)
let screenShakeTimer = 0;
let screenShakeMag = 0;

// 엔티티 고유 ID 생성 카운터
let mobUid = 0;
let bombUid = 0;

// 전투 통계 리포트 데이터
let stats = {
  ghostKills: 0,
  zombieKills: 0,
  skeletonKills: 0,
  bossKills: 0,
  maxSpeed: 0,
  buffsCount: 0,
  critHits: 0
};

// 키 입력 상태
const keys = { left: false, right: false, up: false, down: false };

// 엔티티 관리 배열
let player = null;
let monsters = [];
let projectiles = [];
let particles = [];
let floatingTexts = [];
let bossBombs = [];
let bosses = { dragon: null, demon: null };

// 9종 로그라이크 버프 명세
const CARD_POOL = [
  { id: 'heal', name: '응급치료', grade: '일반', icon: '🩹', color: '#44ff44', desc: '하트 1칸을 즉시 회복합니다.' },
  { id: 'shield', name: '보호막', grade: '일반', icon: '🛡️', color: '#38bdf8', desc: '1회 피해를 방어하는 보호막을 생성합니다. (최대 1개, 소멸 시 1초 무적)' },
  { id: 'speed', name: '신속의 장화', grade: '일반', icon: '🥾', color: '#88ccff', desc: '이동 속도가 10% 증가합니다.' },
  { id: 'sharp', name: '날카로운 무기', grade: '희귀', icon: '🗡️', color: '#ffaa00', desc: '치명타 확률이 10% 증가합니다. (치명타 시 2배 피해)' },
  { id: 'atk_up', name: '무기 연마', grade: '희귀', icon: '⚔️', color: '#ffaa00', desc: '기본 공격력이 5 증가합니다.' },
  { id: 'cd_down', name: '가속의 부적', grade: '희귀', icon: '⚡', color: '#ffaa00', desc: '스킬 쿨타임이 10% 감소합니다.' },
  { id: 'score_copy', name: '점수복사버튼', grade: '희귀', icon: '🪙', color: '#ffaa00', desc: '점수 획득량이 10% 증가합니다.' },
  { id: 'max_hp', name: '생명의 그릇', grade: '영웅', icon: '🏺', color: '#cc44ff', desc: '최대 하트가 1칸 늘어나고 1칸 회복합니다.' },
  { id: 'time', name: '시간의 모래시계', grade: '전설', icon: '⏳', color: '#ff0055', desc: '제한 시간이 10초 연장됩니다.' }
];

// --- 3. UI 및 네비게이션 함수 ---
function showSelectScreen() {
  document.getElementById('screen-title').style.display = 'none';
  document.getElementById('screen-select').style.display = 'flex';
}
window.showSelectScreen = showSelectScreen;

function backToTitle() {
  clearAllEntityDOM();
  document.getElementById('screen-select').style.display = 'none';
  document.getElementById('modal-result').style.display = 'none';
  document.getElementById('modal-records').style.display = 'none';
  document.getElementById('screen-title').style.display = 'flex';
  gameState = 'TITLE';
}
window.backToTitle = backToTitle;

function selectChar(type, btn) {
  selectedChar = type;
  document.querySelectorAll('#screen-select .select-group')[0].querySelectorAll('.choice-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  checkDepartable();
}
window.selectChar = selectChar;

function selectDiff(type, btn) {
  selectedDiff = type;
  document.querySelectorAll('#screen-select .select-group')[1].querySelectorAll('.choice-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  checkDepartable();
}
window.selectDiff = selectDiff;

function checkDepartable() {
  if (selectedChar && selectedDiff) {
    document.getElementById('btn-depart').disabled = false;
  }
}

function showRules() {
  document.getElementById('modal-rules').style.display = 'flex';
}
window.showRules = showRules;

function closeRules() {
  document.getElementById('modal-rules').style.display = 'none';
}
window.closeRules = closeRules;

function openLeaderboard() {
  document.getElementById('modal-records').style.display = 'flex';
  if (window.loadLeaderboard) window.loadLeaderboard();
}
window.openLeaderboard = openLeaderboard;

function closeLeaderboard() {
  document.getElementById('modal-records').style.display = 'none';
}
window.closeLeaderboard = closeLeaderboard;

// --- 4. 게임 시작 및 초기화 ---
function startGame() {
  clearAllEntityDOM();
  document.getElementById('screen-select').style.display = 'none';

  let baseHearts = selectedChar === 'warrior' ? 5 : 3;
  let skillCooldown = selectedChar === 'warrior' ? 8 : (selectedChar === 'mage' ? 12 : 10);
  let normalAtkCd = selectedChar === 'warrior' ? 0.35 : (selectedChar === 'mage' ? 0.50 : 0.25);

  player = {
    x: 80,
    y: FLOOR_1_Y - 64,
    width: 64,
    height: 64,
    vx: 0,
    vy: 0,
    speed: 5.0,
    isGrounded: true,
    facing: 1,
    ignorePlatformTimer: 0,
    hearts: baseHearts,
    maxHearts: baseHearts,
    shield: 0,
    invincibleTimer: 0,
    normalAtkCd: normalAtkCd,
    normalAtkTimer: 0,
    skillMaxCd: skillCooldown,
    skillTimer: 0,
    swingTimer: 0,
    atkPower: 10,
    rangeMult: 1.0,
    cooldownMult: 1.0,
    multiShot: 1,
    scoreMult: 1.0,
    critStacks: 0,
    buffCounts: {}
  };

  monsters = [];
  projectiles = [];
  particles = [];
  floatingTexts = [];
  bossBombs = [];
  bosses = { dragon: null, demon: null };

  timeLeft = 180;
  score = 0;
  lastUpgradeScore = 0;
  pendingUpgrades = 0;
  lastDistanceSpawn = 0;
  cameraX = 0;
  readyTimer = 1.2;
  warningTimer = 0;

  stats = {
    ghostKills: 0,
    zombieKills: 0,
    skeletonKills: 0,
    bossKills: 0,
    maxSpeed: 0,
    buffsCount: 0,
    critHits: 0
  };

  spawnMonsterAtX(450, false);
  spawnMonsterAtX(650, false);
  spawnMonsterAtX(800, true);

  gameState = 'READY';
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}
window.startGame = startGame;

// --- 5. 100점 달성 로그라이크 카드 업그레이드 ---
function triggerUpgrade() {
  if (gameState !== 'PLAYING') return;
  gameState = 'UPGRADE';

  const container = document.getElementById('cards-box');
  container.innerHTML = '';

  const shuffled = [...CARD_POOL].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 3);

  selected.forEach(card => {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `
      <div>
        <div class="card-grade" style="color:${card.color};">${card.grade}</div>
        <div class="card-title" style="display:flex; align-items:center; gap:6px;">
          <img src="assets/icons/${card.id}.png" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';" style="width:24px; height:24px; image-rendering:pixelated;">
          <span style="display:none;">${card.icon}</span>
          <span>${card.name}</span>
        </div>
      </div>
      <div class="card-desc">${card.desc}</div>
    `;
    el.onclick = () => applyCard(card.id, card.icon);
    container.appendChild(el);
  });

  document.getElementById('modal-upgrade').style.display = 'flex';
}

function applyCard(id, icon) {
  stats.buffsCount++;
  // 아이콘 이미지 렌더링을 위해 카드 ID로 카운트 저장
  player.buffCounts[id] = (player.buffCounts[id] || 0) + 1;

  if (id === 'heal') player.hearts = Math.min(player.maxHearts, player.hearts + 1);
  if (id === 'shield') player.shield = 1;
  if (id === 'speed') player.speed *= 1.10;
  if (id === 'sharp') player.critStacks += 1;
  if (id === 'atk_up') player.atkPower += 5;
  if (id === 'cd_down') player.cooldownMult *= 0.90;
  if (id === 'score_copy') player.scoreMult *= 1.10;
  if (id === 'max_hp') { player.maxHearts += 1; player.hearts += 1; }
  if (id === 'time') timeLeft += 10;

  document.getElementById('modal-upgrade').style.display = 'none';
  pendingUpgrades--;

  if (pendingUpgrades > 0) {
    triggerUpgrade();
  } else {
    gameState = 'PLAYING';
  }
}

// --- 6. 거리 기반 스폰 및 보스 출현 ---
function getDiffSpawnDistance() {
  if (selectedDiff === 'easy') return 50 * SCALE_X;
  if (selectedDiff === 'normal') return 35 * SCALE_X;
  return 25 * SCALE_X;
}

function spawnMonsterAtX(targetX, force2F = false) {
  const is2F = force2F || (Math.random() < 0.35);
  let type = 'ghost';
  let emoji = '👻';
  let hp = 10;
  let pts = 10;

  if (is2F) {
    type = 'skeleton';
    emoji = '💀';
    pts = 30;
    hp = selectedDiff === 'easy' ? 30 : 40;
  } else {
    if (Math.random() < 0.5) {
      type = 'ghost';
      emoji = '👻';
      pts = 10;
      hp = selectedDiff === 'easy' ? 10 : 20;
    } else {
      type = 'zombie';
      emoji = '🧟';
      pts = 20;
      hp = selectedDiff === 'easy' ? 20 : 30;
    }
  }

  const groundY = is2F ? FLOOR_2_Y : FLOOR_1_Y;
  const spawnY = groundY - 64;

  mobUid++;
  monsters.push({
    id: mobUid,
    type,
    emoji,
    assetKey: 'mob_' + type,
    x: targetX,
    y: spawnY,
    baseY: groundY,
    width: 64,
    height: 64,
    hp: hp,
    maxHp: hp,
    points: pts,
    floor: is2F ? 2 : 1,
    shootTimer: Math.random() * 1.5,
    jumpTimer: Math.random() * 2,
    vy: 0,
    isGrounded: true,
    hitFlash: 0
  });
}

function checkBossSpawn() {
  // 드래곤 (600m = 6,000px)
  if (!bosses.dragon && player.x >= 580 * SCALE_X) {
    let dhp = selectedDiff === 'easy' ? 100 : (selectedDiff === 'normal' ? 200 : 300);
    bosses.dragon = {
      type: 'dragon',
      name: '드래곤',
      emoji: '🐉',
      assetKey: 'boss_dragon',
      x: 600 * SCALE_X + 500,
      y: FLOOR_2_Y - 96,
      width: 96,
      height: 96,
      hp: dhp,
      maxHp: dhp,
      points: 200,
      patternTimer: 0,
      active: true,
      hitFlash: 0
    };
    warningTimer = 2.0;
  }

  // 마왕 (1,400m = 14,000px)
  if (!bosses.demon && player.x >= 1380 * SCALE_X) {
    let mhp = selectedDiff === 'easy' ? 300 : (selectedDiff === 'normal' ? 500 : 700);
    bosses.demon = {
      type: 'demon',
      name: '마왕',
      emoji: '👿',
      assetKey: 'boss_demon',
      x: 1400 * SCALE_X + 500,
      y: FLOOR_1_Y - 96,
      width: 96,
      height: 96,
      hp: mhp,
      maxHp: mhp,
      points: 500,
      patternTimer: 0,
      active: true,
      hitFlash: 0
    };
    warningTimer = 2.0;
  }
}

// --- 7. 메인 업데이트 루프 ---
let lastTime = 0;
function gameLoop(time) {
  let dt = (time - lastTime) / 1000;
  lastTime = time;
  if (dt > 0.05) dt = 0.05;

  if (gameState === 'READY') {
    readyTimer -= dt;
    if (readyTimer <= 0) gameState = 'PLAYING';
  } else if (gameState === 'PLAYING') {
    update(dt);
  }
  render();

  if (gameState === 'READY' || gameState === 'PLAYING' || gameState === 'UPGRADE') {
    requestAnimationFrame(gameLoop);
  }
}

function update(dt) {
  timeLeft -= dt;
  if (timeLeft <= 0) {
    timeLeft = 0;
    endGame(false);
    return;
  }

  let dt60 = dt * 60;

  // 플레이어 이동 및 달리기 관성
  if (keys.left) { player.vx = -player.speed; player.facing = -1; }
  else if (keys.right) { player.vx = player.speed; player.facing = 1; }
  else { player.vx = 0; }

  let curSpeedMps = player.speed * 3.0;
  if (curSpeedMps > stats.maxSpeed) stats.maxSpeed = curSpeedMps;

  // 중력 및 위치 계산
  player.vy += 0.85 * dt60;
  player.x += player.vx * dt60;
  player.y += player.vy * dt60;

  if (player.x < 0) player.x = 0;

  if (player.ignorePlatformTimer > 0) player.ignorePlatformTimer -= dt;

  let feetY = player.y + player.height;
  let prevFeetY = feetY - (player.vy * dt60);

  // 2층 발판 착지
  if (player.ignorePlatformTimer <= 0 && player.vy >= 0 && prevFeetY <= FLOOR_2_Y + 4 && feetY >= FLOOR_2_Y) {
    player.y = FLOOR_2_Y - player.height;
    player.vy = 0;
    player.isGrounded = true;
  } 
  // 1층 바닥 착지
  else if (player.y + player.height >= FLOOR_1_Y) {
    player.y = FLOOR_1_Y - player.height;
    player.vy = 0;
    player.isGrounded = true;
  }

  // 타이머 갱신
  if (player.invincibleTimer > 0) player.invincibleTimer -= dt;
  if (player.skillTimer > 0) player.skillTimer -= dt;
  if (player.normalAtkTimer > 0) player.normalAtkTimer -= dt;
  if (player.swingTimer > 0) player.swingTimer -= dt;
  if (screenShakeTimer > 0) screenShakeTimer -= dt;
  if (warningTimer > 0) warningTimer -= dt;

  // 카메라 제어 (보스 조우 시 화면 잠금)
  let lockCamera = false;
  if (bosses.dragon && bosses.dragon.active) lockCamera = true;
  if (bosses.demon && bosses.demon.active) lockCamera = true;

  if (lockCamera) {
    let lockTargetX = (bosses.dragon && bosses.dragon.active) ? 600 * SCALE_X : 1400 * SCALE_X;
    cameraX = lockTargetX - 100;
    if (player.x < cameraX) player.x = cameraX;
    if (player.x > cameraX + 800) player.x = cameraX + 800;
  } else {
    cameraX = Math.max(0, player.x - 200);
  }

  // 거리 스폰
  checkBossSpawn();
  let spawnInterval = getDiffSpawnDistance();
  if (player.x - lastDistanceSpawn >= spawnInterval && player.x < 1350 * SCALE_X) {
    spawnMonsterAtX(player.x + 850);
    lastDistanceSpawn = player.x;
  }

  // 투사체 처리
  for (let i = projectiles.length - 1; i >= 0; i--) {
    let p = projectiles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;

    if (p.isPlayer) {
      monsters.forEach(m => {
        if (checkRectCollide(p, m)) {
          damageMonster(m, p.dmg, p.x, p.y, p.isCrit);
          p.life = 0;
          if (p.isExplosive) createShockwave(p.x, p.y, 65, '#38bdf8');
        }
      });
      [bosses.dragon, bosses.demon].forEach(b => {
        if (b && b.active && checkRectCollide(p, b)) {
          damageBoss(b, p.dmg, p.x, p.y, p.isCrit);
          p.life = 0;
          if (p.isExplosive) createShockwave(p.x, p.y, 80, '#38bdf8');
        }
      });
    } else {
      if (checkRectCollide(p, player)) {
        hitPlayer();
        p.life = 0;
      }
    }

    if (p.life <= 0) projectiles.splice(i, 1);
  }

  // 몬스터 AI
  for (let i = monsters.length - 1; i >= 0; i--) {
    let m = monsters[i];
    let speedMult = selectedDiff === 'hard' ? 1.15 : 1.0;
    if (m.hitFlash > 0) m.hitFlash -= dt;

    if (m.type === 'ghost') {
      m.jumpTimer += dt;
      if (m.isGrounded && m.jumpTimer > 1.2) {
        m.vy = -8.5;
        m.isGrounded = false;
        m.jumpTimer = 0;
      }
      if (!m.isGrounded) {
        m.vy += 0.65 * dt60;
        m.y += m.vy * dt60;
        m.x -= 60 * speedMult * dt;
        if (m.y + m.height >= m.baseY) {
          m.y = m.baseY - m.height;
          m.vy = 0;
          m.isGrounded = true;
        }
      }
    } 
    else if (m.type === 'zombie') {
      m.x -= 110 * speedMult * dt;
    } 
    else if (m.type === 'skeleton') {
      m.shootTimer += dt;
      if (m.shootTimer > 2.0) {
        m.shootTimer = 0;
        let angle = Math.atan2((player.y + 20) - (m.y + 15), (player.x + 16) - m.x);
        projectiles.push({
          x: m.x, y: m.y + 15, width: 16, height: 16,
          vx: Math.cos(angle) * 230, vy: Math.sin(angle) * 230,
          life: 3, isPlayer: false, isEmoji: true, emojiText: '🦴', isCustomBox: true
        });
      }
    }

    if (checkRectCollide(player, m)) hitPlayer();

    // 화면 뒤로 지나간 몬스터 제거 및 DOM 잔상 정리
    if (m.x < cameraX - 250) {
      removeEntityDOM('mob_' + m.id);
      monsters.splice(i, 1);
    }
  }

  updateBosses(dt);
  updateBossBombs(dt);

  // 파티클 & 플로팅 스코어
  for (let i = particles.length - 1; i >= 0; i--) {
    let pt = particles[i];
    pt.alpha -= dt * (pt.decay || 2.5);
    if (pt.vx) pt.x += pt.vx * dt60;
    if (pt.vy) pt.y += pt.vy * dt60;
    if (pt.r !== undefined && pt.expand) pt.r += pt.expand * dt60;
    if (pt.alpha <= 0) particles.splice(i, 1);
  }

  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    let ft = floatingTexts[i];
    ft.y -= 25 * dt;
    ft.alpha -= dt * 1.5;
    if (ft.alpha <= 0) floatingTexts.splice(i, 1);
  }
}

// --- 8. 스타 유즈맵식 보스 폭탄피하기 시스템 ---
function spawnBossBomb(x, y, assetKey, emoji, warningSec = 0.6) {
  bombUid++;
  bossBombs.push({
    id: bombUid,
    x: x,
    y: y,
    width: 64,
    height: 64,
    assetKey: assetKey,
    emoji: emoji,
    state: 'warning',
    timer: warningSec,
    explodeTimer: 0.9,
    hitDone: false
  });
}

function updateBossBombs(dt) {
  for (let i = bossBombs.length - 1; i >= 0; i--) {
    let b = bossBombs[i];
    if (b.state === 'warning') {
      b.timer -= dt;
      if (b.timer <= 0) {
        b.state = 'exploding';
        triggerScreenShake(0.1, 4);
      }
    } else if (b.state === 'exploding') {
      b.explodeTimer -= dt;
      if (!b.hitDone) {
        let centerBx = b.x + 32;
        let centerBy = b.y + 32;
        let centerPx = player.x + 32;
        let centerPy = player.y + 32;
        let dist = Math.hypot(centerBx - centerPx, centerBy - centerPy);
        if (dist < 42) {
          hitPlayer();
          b.hitDone = true;
        }
      }
      if (b.explodeTimer <= 0) {
        removeEntityDOM('bomb_' + b.id);
        bossBombs.splice(i, 1);
      }
    }
  }
}

function updateBosses(dt) {
  // 드래곤 (600m)
  let d = bosses.dragon;
  if (d && d.active) {
    if (d.hitFlash > 0) d.hitFlash -= dt;
    d.patternTimer += dt;

    if (d.patternTimer > 3.0) {
      d.patternTimer = 0;
      // [도미노 융단폭격] 1층 또는 2층 랜덤 선택 후 순차 폭발
      let targetFloorY = Math.random() < 0.5 ? FLOOR_1_Y : FLOOR_2_Y;
      let startX = d.x - 100;
      for (let k = 0; k < 4; k++) {
        let bombX = startX - (k * 130);
        let bombY = targetFloorY - 64;
        setTimeout(() => {
          if (gameState === 'PLAYING') spawnBossBomb(bombX, bombY, 'effect_fireball', '🔥', 0.6);
        }, k * 150);
      }
    }
    if (checkRectCollide(player, d)) hitPlayer();
  }

  // 마왕 (1,400m)
  let m = bosses.demon;
  if (m && m.active) {
    if (m.hitFlash > 0) m.hitFlash -= dt;
    m.patternTimer += dt;
    let cd = (m.hp / m.maxHp <= 0.3) ? 1.6 : 2.5;

    if (m.patternTimer > cd) {
      m.patternTimer = 0;
      if (Math.random() < 0.5) {
        // [단일 정밀타격] 플레이어 발밑 조준
        spawnBossBomb(player.x, player.y, 'effect_darkorb', '🟣', 0.5);
      } else {
        // [직선 궤적 저격] 마왕 -> 플레이어 방향 3연쇄 폭발
        let pX = player.x;
        let pY = player.y;
        for (let k = 0; k < 3; k++) {
          let stepX = m.x + (pX - m.x) * ((k + 1) / 3);
          let stepY = m.y + (pY - m.y) * ((k + 1) / 3);
          setTimeout(() => {
            if (gameState === 'PLAYING') spawnBossBomb(stepX, stepY, 'effect_darkorb', '🟣', 0.4);
          }, k * 120);
        }
      }
    }
    if (checkRectCollide(player, m)) hitPlayer();
  }
}

// --- 9. 전투 액션 및 치명타 연산 ---
function calcDamage() {
  let critChance = 1 - Math.pow(0.9, player.critStacks);
  let isCrit = Math.random() < critChance;
  let finalDmg = player.atkPower * (isCrit ? 2.0 : 1.0);
  if (isCrit) {
    stats.critHits++;
    triggerScreenShake(0.1, 5);
  }
  return { dmg: finalDmg, isCrit };
}

function doNormalAttack() {
  if (gameState !== 'PLAYING' || player.normalAtkTimer > 0) return;
  player.normalAtkTimer = player.normalAtkCd;
  player.swingTimer = 0.18;

  let attackData = calcDamage();

  if (selectedChar === 'warrior') {
    let reach = 70 * player.rangeMult;
    let hitBox = {
      x: player.facing === 1 ? player.x + player.width : player.x - reach,
      y: player.y - 15,
      width: reach,
      height: player.height + 30,
      isCustomBox: true
    };

    particles.push({
      type: 'slash_arc',
      x: player.x + (player.facing === 1 ? player.width + 10 : -10),
      y: player.y + player.height / 2,
      facing: player.facing,
      radius: 45 * player.rangeMult,
      alpha: 1.0,
      decay: 5.5,
      color: attackData.isCrit ? '#facc15' : '#e2e8f0'
    });

    monsters.forEach(m => {
      if (checkRectCollide(hitBox, m)) damageMonster(m, attackData.dmg, m.x + m.width/2, m.y + m.height/2, attackData.isCrit);
    });
    [bosses.dragon, bosses.demon].forEach(b => {
      if (b && b.active && checkRectCollide(hitBox, b)) damageBoss(b, attackData.dmg, b.x + 20, b.y + b.height/2, attackData.isCrit);
    });
  } 
  else if (selectedChar === 'mage') {
    for (let i = 0; i < player.multiShot; i++) {
      projectiles.push({
        x: player.facing === 1 ? player.x + player.width : player.x - 20,
        y: player.y + 20 + (i * 8),
        width: 20, height: 20,
        vx: player.facing * 400, vy: 0,
        life: 1.5, isPlayer: true, isExplosive: true, isEmoji: true, emojiText: '⚡', dmg: attackData.dmg, isCrit: attackData.isCrit, isCustomBox: true
      });
    }
  } 
  else if (selectedChar === 'archer') {
    for (let i = 0; i < player.multiShot; i++) {
      projectiles.push({
        x: player.facing === 1 ? player.x + player.width : player.x - 24,
        y: player.y + 26 + (i * 6),
        width: 24, height: 8,
        vx: player.facing * 620, vy: (Math.random() - 0.5) * 20,
        life: 1.5, isPlayer: true, dmg: attackData.dmg, isCrit: attackData.isCrit, color: attackData.isCrit ? '#facc15' : '#e2e8f0', isCustomBox: true
      });
    }
  }
}

function doSkill() {
  if (gameState !== 'PLAYING' || player.skillTimer > 0) return;
  player.skillTimer = player.skillMaxCd * player.cooldownMult;
  player.swingTimer = 0.25;

  let attackData = calcDamage();

  if (selectedChar === 'warrior') {
    let spinBox = {
      x: player.x - 60, y: player.y - 40,
      width: player.width + 120, height: player.height + 80,
      isCustomBox: true
    };

    particles.push({
      type: 'spin_slash',
      x: player.x + player.width / 2,
      y: player.y + player.height / 2,
      radius: 65 * player.rangeMult,
      alpha: 1.0,
      decay: 4.0,
      color: '#f87171'
    });

    createShockwave(player.x + player.width/2, player.y + player.height/2, 70, '#f87171');

    monsters.forEach(m => {
      if (checkRectCollide(spinBox, m)) damageMonster(m, attackData.dmg + 20, m.x + m.width/2, m.y + m.height/2, attackData.isCrit);
    });
    [bosses.dragon, bosses.demon].forEach(b => {
      if (b && b.active && checkRectCollide(spinBox, b)) damageBoss(b, attackData.dmg + 20, b.x + 20, b.y + b.height/2, attackData.isCrit);
    });
  } 
  else if (selectedChar === 'mage') {
    let lX = player.facing === 1 ? player.x + 40 : player.x - 340;
    let lightningArea = { x: lX, y: 0, width: 340, height: 500, isCustomBox: true };

    for (let k = 0; k < 4; k++) {
      createLightningBolt(lX + 40 + (k * 70));
    }

    monsters.forEach(m => {
      if (checkRectCollide(lightningArea, m)) damageMonster(m, attackData.dmg + 30, m.x + m.width/2, m.y + m.height/2, attackData.isCrit);
    });
    [bosses.dragon, bosses.demon].forEach(b => {
      if (b && b.active && checkRectCollide(lightningArea, b)) damageBoss(b, attackData.dmg + 30, b.x + 20, b.y + b.height/2, attackData.isCrit);
    });
  } 
  else if (selectedChar === 'archer') {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        if (gameState !== 'PLAYING') return;
        projectiles.push({
          x: player.facing === 1 ? player.x + player.width : player.x - 24,
          y: player.y + 26,
          width: 26, height: 8,
          vx: player.facing * 660, vy: (i - 2) * 25,
          life: 1.5, isPlayer: true, dmg: attackData.dmg + 10, isCrit: attackData.isCrit, color: '#fb923c', isCustomBox: true
        });
      }, i * 45);
    }
  }
}

function damageMonster(m, dmg, hitX, hitY, isCrit) {
  m.hp -= dmg;
  m.hitFlash = 0.15;
  createSparks(hitX || (m.x + m.width/2), hitY || (m.y + m.height/2), isCrit ? '#facc15' : '#ffffff', isCrit ? 8 : 4);

  if (m.hp <= 0) {
    if (m.type === 'ghost') stats.ghostKills++;
    else if (m.type === 'zombie') stats.zombieKills++;
    else if (m.type === 'skeleton') stats.skeletonKills++;

    addScore(m.points);
    spawnFloatingText(m.x + m.width/2, m.y, `+${m.points}`);
    createSparks(m.x + m.width/2, m.y + m.height/2, '#f87171', 10);
    removeEntityDOM('mob_' + m.id);
    let idx = monsters.indexOf(m);
    if (idx > -1) monsters.splice(idx, 1);
  }
}

function damageBoss(b, dmg, hitX, hitY, isCrit) {
  b.hp -= dmg;
  b.hitFlash = 0.15;
  createSparks(hitX || (b.x + 20), hitY || (b.y + b.height/2), isCrit ? '#facc15' : '#fbbf24', 6);

  if (b.hp <= 0) {
    b.active = false;
    stats.bossKills++;
    addScore(b.points);
    spawnFloatingText(b.x + b.width/2, b.y, `+${b.points}`);
    createShockwave(b.x + b.width/2, b.y + b.height/2, 120, '#ef4444');
    triggerScreenShake(0.3, 8);
    removeEntityDOM('boss_' + b.type);

    if (b.type === 'dragon') {
      pendingUpgrades += 2;
      triggerUpgrade();
    } else if (b.type === 'demon') {
      endGame(true);
    }
  }
}

function hitPlayer() {
  if (player.invincibleTimer > 0) return;

  if (player.shield > 0) {
    player.shield = 0;
    player.invincibleTimer = 1.0;
    createShockwave(player.x + player.width/2, player.y + player.height/2, 60, '#38bdf8');
    createSparks(player.x + 32, player.y + 32, '#38bdf8', 10);
    triggerScreenShake(0.15, 6);
    return;
  }

  player.hearts -= 1;
  player.invincibleTimer = 1.0;
  createSparks(player.x + 32, player.y + 32, '#ef4444', 8);
  triggerScreenShake(0.15, 6);

  if (player.hearts <= 0) {
    player.hearts = 0;
    endGame(false);
  }
}

function addScore(basePts) {
  let earned = Math.floor(basePts * player.scoreMult);
  score += earned;
  if (score - lastUpgradeScore >= 100) {
    let count = Math.floor((score - lastUpgradeScore) / 100);
    lastUpgradeScore += count * 100;
    pendingUpgrades += count;
    triggerUpgrade();
  }
}

// --- 10. 결산 및 명예의 전당 등록 ---
let finalCalculatedScore = 0;

async function endGame(clear) {
  gameState = 'RESULT';
  clearAllEntityDOM();
  finalCalculatedScore = score;
  let timeBonus = 0;
  if (clear) {
    timeBonus = Math.floor(timeLeft) * 10;
    finalCalculatedScore += timeBonus;
  }

  let rank = 'C';
  if (finalCalculatedScore >= 3500) rank = 'S';
  else if (finalCalculatedScore >= 2500) rank = 'A';
  else if (finalCalculatedScore >= 1500) rank = 'B';

  document.getElementById('result-title').innerText = clear ? '마왕 토벌 작전 성공!' : '작전 실패 (사망/타임오버)';
  document.getElementById('result-title').style.color = clear ? '#ffcc00' : '#ef4444';
  document.getElementById('res-score').innerText = finalCalculatedScore.toLocaleString();
  document.getElementById('res-rank').innerText = rank;

  let totalKills = stats.ghostKills + stats.zombieKills + stats.skeletonKills + stats.bossKills;
  document.getElementById('report-content').innerHTML = `
    • 잔여 시간 보너스 : ${Math.floor(timeLeft)}초 (+${timeBonus} P)<br>
    • 처치한 몬스터 : 총 ${totalKills}마리 (유령 ${stats.ghostKills}, 좀비 ${stats.zombieKills}, 스켈레톤 ${stats.skeletonKills}, 보스 ${stats.bossKills})<br>
    • 달성 최고 속도 : ${stats.maxSpeed.toFixed(1)} m/s<br>
    • 획득 버프 카드 : 총 ${stats.buffsCount}개<br>
    • 치명타 적중 횟수 : 총 ${stats.critHits}회
  `;

  const isEligible = await window.checkTop3Eligibility(selectedDiff, finalCalculatedScore);
  const entryBox = document.getElementById('initials-entry-box');
  if (isEligible) {
    entryBox.style.display = 'block';
  } else {
    entryBox.style.display = 'none';
  }

  document.getElementById('modal-result').style.display = 'flex';
}

async function submitInitialScore() {
  const input = document.getElementById('input-initials');
  let initials = (input.value || 'AAA').trim().substring(0, 3).toUpperCase();
  if (!initials) initials = 'AAA';

  const btn = document.getElementById('btn-save-score');
  btn.disabled = true;
  btn.innerText = '저장 중';

  await window.saveScoreToFirebase(selectedDiff, initials, finalCalculatedScore, selectedChar);
  document.getElementById('initials-entry-box').style.display = 'none';
  openLeaderboard();
}
window.submitInitialScore = submitInitialScore;

// --- 11. 시각 효과 및 판정 헬퍼 ---
function triggerScreenShake(time, mag) {
  // 화면 흔들림 완전 제거
  screenShakeTimer = 0;
  screenShakeMag = 0;
}

function spawnFloatingText(x, y, text) {
  floatingTexts.push({ x, y, text, alpha: 1.0 });
}

// [정밀 히트박스] 외곽 투명 여백을 깎아내고 실제 눈에 보이는 캐릭터 몸통만 정밀 판정
function getHitbox(e) {
  if (e.isCustomBox) return e;

  let padX = e.width * 0.22;       // 좌우 22% 투명 여백 제외
  let padTop = e.height * 0.15;    // 상단 15% 머리 위 여백 제외
  let padBottom = e.height * 0.05; // 발바닥 5% 여백 제외

  return {
    x: e.x + padX,
    y: e.y + padTop,
    width: e.width - (padX * 2),
    height: e.height - padTop - padBottom
  };
}

function checkRectCollide(r1, r2) {
  const b1 = r1.isCustomBox ? r1 : getHitbox(r1);
  const b2 = r2.isCustomBox ? r2 : getHitbox(r2);

  return (b1.x < b2.x + b2.width &&
          b1.x + b1.width > b2.x &&
          b1.y < b2.y + b2.height &&
          b1.y + b1.height > b2.y);
}

function createSparks(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    let angle = Math.random() * Math.PI * 2;
    let spd = 2 + Math.random() * 5;
    particles.push({
      type: 'spark',
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      color,
      size: 2 + Math.random() * 2,
      alpha: 1.0,
      decay: 3.5
    });
  }
}

function createShockwave(x, y, maxR, color) {
  particles.push({
    type: 'shockwave',
    x, y,
    r: 5,
    maxR,
    expand: 5.0,
    color,
    alpha: 0.9,
    decay: 3.0
  });
}

function createLightningBolt(targetX) {
  let pts = [];
  let curY = 0;
  let curX = targetX;
  pts.push({ x: curX, y: curY });
  while (curY < FLOOR_1_Y) {
    curY += 25 + Math.random() * 30;
    curX += (Math.random() - 0.5) * 40;
    pts.push({ x: curX, y: Math.min(curY, FLOOR_1_Y) });
  }
  particles.push({
    type: 'lightning',
    points: pts,
    alpha: 1.0,
    decay: 3.0,
    color: '#38bdf8'
  });
}

// --- 12. 캔버스 렌더링 루프 및 네이티브 GIF 동기화 ---
function render() {
  ctx.save();

  if (screenShakeTimer > 0) {
    let ox = (Math.random() - 0.5) * screenShakeMag * 2;
    let oy = (Math.random() - 0.5) * screenShakeMag * 2;
    ctx.translate(ox, oy);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. [테마별 배경 & 전환 그라데이션 연출]
  let curDist = player ? player.x / SCALE_X : 0;

  // 거리 기반 테마 블렌딩 비율 계산 (550~650m, 1350~1450m 전환 구간)
  let w1 = 0, w2 = 0, w3 = 0;
  if (curDist < 550) {
    w1 = 1;
  } else if (curDist < 650) {
    let t = (curDist - 550) / 100;
    w1 = 1 - t; w2 = t;
  } else if (curDist < 1350) {
    w2 = 1;
  } else if (curDist < 1450) {
    let t = (curDist - 1350) / 100;
    w2 = 1 - t; w3 = t;
  } else {
    w3 = 1;
  }

  // (1) 1구간 : 여명의 초원 (0 ~ 600m)
  if (w1 > 0) {
    ctx.save();
    ctx.globalAlpha = w1;
    let skyGrd = ctx.createLinearGradient(0, 0, 0, FLOOR_1_Y);
    skyGrd.addColorStop(0, '#1e3a8a');
    skyGrd.addColorStop(0.6, '#38bdf8');
    skyGrd.addColorStop(1, '#bae6fd');
    ctx.fillStyle = skyGrd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 원경 산맥 실루엣 (느린 패럴랙스)
    ctx.fillStyle = '#166534';
    ctx.beginPath();
    ctx.moveTo(0, FLOOR_1_Y);
    for (let x = 0; x <= canvas.width; x += 150) {
      let h = Math.sin((x + cameraX * 0.2) * 0.01) * 45 + 70;
      ctx.lineTo(x, FLOOR_1_Y - h);
    }
    ctx.lineTo(canvas.width, FLOOR_1_Y);
    ctx.fill();
    ctx.restore();
  }

  // (2) 2구간 : 화염 협곡 (600 ~ 1400m)
  if (w2 > 0) {
    ctx.save();
    ctx.globalAlpha = w2;
    let skyGrd = ctx.createLinearGradient(0, 0, 0, FLOOR_1_Y);
    skyGrd.addColorStop(0, '#450a0a');
    skyGrd.addColorStop(0.5, '#991b1b');
    skyGrd.addColorStop(1, '#ea580c');
    ctx.fillStyle = skyGrd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 뾰족한 바위산 실루엣
    ctx.fillStyle = '#431407';
    ctx.beginPath();
    ctx.moveTo(0, FLOOR_1_Y);
    for (let x = 0; x <= canvas.width; x += 120) {
      let h = ((x + Math.floor(cameraX * 0.2)) % 240 < 120) ? 95 : 40;
      ctx.lineTo(x, FLOOR_1_Y - h);
    }
    ctx.lineTo(canvas.width, FLOOR_1_Y);
    ctx.fill();
    ctx.restore();
  }

  // (3) 3구간 : 심연의 마왕성 (1400m 이상)
  if (w3 > 0) {
    ctx.save();
    ctx.globalAlpha = w3;
    let skyGrd = ctx.createLinearGradient(0, 0, 0, FLOOR_1_Y);
    skyGrd.addColorStop(0, '#090214');
    skyGrd.addColorStop(0.7, '#2e1065');
    skyGrd.addColorStop(1, '#581c87');
    ctx.fillStyle = skyGrd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 붉은 보름달
    ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.beginPath();
    ctx.arc(canvas.width - 150, 100, 45, 0, Math.PI * 2);
    ctx.fill();

    // 고딕 성채 기둥 실루엣
    ctx.fillStyle = '#1e0b36';
    for (let x = -50; x < canvas.width + 100; x += 140) {
      let colX = x - (Math.floor(cameraX * 0.15) % 140);
      ctx.fillRect(colX, 60, 36, FLOOR_1_Y - 60);
    }
    ctx.restore();
  }

  // 지형 바닥 및 2층 발판 (테마별 색상 블렌딩)
  let pCol = w3 > 0.5 ? '#701a75' : (w2 > 0.5 ? '#78350f' : '#65a30d');
  let gCol = w3 > 0.5 ? '#3b0764' : (w2 > 0.5 ? '#b45309' : '#22c55e');

  // 2층 발판 (상단)
  ctx.fillStyle = pCol;
  ctx.fillRect(0, FLOOR_2_Y, canvas.width, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(0, FLOOR_2_Y, canvas.width, 3);

  // 1층 바닥 (하단)
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, FLOOR_1_Y, canvas.width, canvas.height - FLOOR_1_Y);
  ctx.fillStyle = gCol;
  ctx.fillRect(0, FLOOR_1_Y, canvas.width, 6);

  // 2. 스타 폭탄피하기 장판 렌더링
  bossBombs.forEach(b => {
    let bx = b.x - cameraX;
    if (b.state === 'warning') {
      ctx.save();
      ctx.strokeStyle = Math.floor(Date.now() / 100) % 2 === 0 ? '#ff0055' : '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(bx + 32, b.y + 32, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 0, 85, 0.25)';
      ctx.fill();
      ctx.restore();
    } else if (b.state === 'exploding') {
      ctx.save();
      let glowColor = b.assetKey === 'effect_fireball' ? 'rgba(255, 68, 0, 0.4)' : 'rgba(168, 85, 247, 0.4)';
      ctx.fillStyle = glowColor;
      ctx.beginPath();
      ctx.arc(bx + 32, b.y + 32, 34, 0, Math.PI * 2);
      ctx.fill();

      // 폭탄 네이티브 실시간 GIF DOM 동기화
      let bombSrc = b.assetKey === 'effect_fireball' ? 'assets/effects/fire_ball.gif' : 'assets/effects/dark_orb.gif';
      syncEntityDOM('bomb_' + b.id, bombSrc, bx, b.y, b.width, b.height, 1, false, true);

      // 이미지 부재 시 캔버스 이모티콘 Fallback
      if (!ASSETS.images[b.assetKey]) {
        ctx.font = '40px "NeoDunggeunGothicPro", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.emoji, bx + 32, b.y + 32);
      }
      ctx.restore();
    }
  });

  // 3. 몬스터 렌더링 & [실시간 움직이는 GIF DOM 동기화]
  monsters.forEach(m => {
    let sx = m.x - cameraX;
    let isVisible = (sx >= -80 && sx <= 950);

    // 네이티브 GIF DOM 엔진 동기화 (원본 좌측 시선 유지)
    syncEntityDOM('mob_' + m.id, `assets/monsters/${m.type}.gif`, sx, m.y, m.width, m.height, 1, m.hitFlash > 0, isVisible);

    // 이미지 부재 시 캔버스 백업 이모티콘
    if (!ASSETS.images[m.assetKey]) {
      ctx.save();
      if (m.hitFlash > 0) ctx.filter = 'brightness(3)';
      ctx.font = '44px "NeoDunggeunGothicPro", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(m.emoji, sx + m.width / 2, m.y + m.height + 4);
      ctx.restore();
    }

    // 머리 위 정수 숫자 체력 표기
    ctx.font = '14px "NeoDunggeunGothicPro"';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ef4444';
    ctx.fillText(`HP ${m.hp}`, sx + m.width / 2, m.y - 8);
  });

  // 4. 보스 렌더링 & [실시간 대형 GIF DOM 동기화]
  [bosses.dragon, bosses.demon].forEach(b => {
    if (b && b.active) {
      let bx = b.x - cameraX;

      // 보스 96x96 네이티브 GIF DOM 동기화 (원본 좌측 시선 유지)
      syncEntityDOM('boss_' + b.type, `assets/monsters/${b.type === 'dragon' ? 'dragon' : 'demon'}.gif`, bx, b.y, b.width, b.height, 1, b.hitFlash > 0, true);

      // 이미지 부재 시 백업 이모티콘
      if (!ASSETS.images[b.assetKey]) {
        ctx.save();
        if (b.hitFlash > 0) ctx.filter = 'brightness(3)';
        ctx.font = '76px "NeoDunggeunGothicPro", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(b.emoji, bx + b.width / 2, b.y + b.height);
        ctx.restore();
      }

      // 상단 HUD와 겹치지 않도록 Y=74 위치로 이동 + 배경 박스 추가
      let barX = canvas.width / 2 - 160;
      let barY = 74;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(barX - 10, barY - 18, 340, 42); // 가독성용 암실 패널

      ctx.fillStyle = '#111';
      ctx.fillRect(barX, barY, 320, 16);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(barX, barY, 320 * (b.hp / b.maxHp), 16);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(barX, barY, 320, 16);
      
      ctx.fillStyle = '#ffcc00';
      ctx.font = '14px "NeoDunggeunGothicPro"';
      ctx.textAlign = 'center';
      ctx.fillText(`보스 : ${b.name} (${b.hp} / ${b.maxHp})`, canvas.width / 2, barY - 4);
    }
  });

  // 5. 투사체
  projectiles.forEach(p => {
    let px = p.x - cameraX;
    if (p.isEmoji) {
      ctx.save();
      ctx.font = '22px "NeoDunggeunGothicPro", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.emojiText, px + p.width/2, p.y + p.height/2);
      ctx.restore();
    } else if (p.isPlayer && selectedChar === 'archer') {
      ctx.save();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px, p.y + 4);
      ctx.lineTo(px + p.width, p.y + 4);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      let tipX = p.vx > 0 ? px + p.width : px;
      ctx.beginPath();
      ctx.arc(tipX, p.y + 4, 3, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(px, p.y, p.width, p.height);
    }
  });

  // 6. 플레이어 렌더링 & [실시간 네이티브 GIF 동기화]
  if (player && (player.invincibleTimer <= 0 || Math.floor(Date.now() / 80) % 2 === 0)) {
    let px = player.x - cameraX;
    ctx.save();

    // 보호막 버블
    if (player.shield > 0) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px + player.width/2, player.y + player.height/2, 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.fill();
    }

    // 플레이어 실시간 GIF 동기화 (무적 시간에는 사라지지 않고 45% 반투명 유지)
    let heroOpacity = player.invincibleTimer > 0 ? 0.45 : 1.0;
    syncEntityDOM('player_sprite', `assets/heroes/${selectedChar}.gif`, px, player.y, player.width, player.height, player.facing, false, true, heroOpacity);

    // 이미지 부재 시 대체 이모티콘
    if (!ASSETS.images['hero_' + selectedChar]) {
      let heroEmoji = selectedChar === 'warrior' ? '🥷' : (selectedChar === 'mage' ? '🧙' : '🧝');
      ctx.font = '48px "NeoDunggeunGothicPro", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.translate(px + player.width / 2, player.y + player.height + 4);
      if (player.facing === -1) ctx.scale(-1, 1);
      ctx.fillText(heroEmoji, 0, 0);
    }
    ctx.restore();
  }

  // 7. 이펙트 파티클
  particles.forEach(pt => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, pt.alpha);

    if (pt.type === 'slash_arc') {
      let cx = pt.x - cameraX;
      ctx.lineWidth = 7;
      ctx.strokeStyle = pt.color;
      ctx.lineCap = 'round';
      ctx.beginPath();
      let startAngle = pt.facing === 1 ? -Math.PI * 0.45 : Math.PI * 0.55;
      let endAngle   = pt.facing === 1 ? Math.PI * 0.45  : Math.PI * 1.45;
      ctx.arc(cx, pt.y, pt.radius, startAngle, endAngle, false);
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }
    else if (pt.type === 'spin_slash') {
      let cx = pt.x - cameraX;
      ctx.lineWidth = 8;
      ctx.strokeStyle = pt.color;
      ctx.beginPath();
      ctx.arc(cx, pt.y, pt.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    }
    else if (pt.type === 'lightning') {
      ctx.lineWidth = 5;
      ctx.strokeStyle = pt.color;
      ctx.beginPath();
      pt.points.forEach((p, idx) => {
        let lx = p.x - cameraX;
        if (idx === 0) ctx.moveTo(lx, p.y);
        else ctx.lineTo(lx, p.y);
      });
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }
    else if (pt.type === 'shockwave') {
      ctx.lineWidth = 4;
      ctx.strokeStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x - cameraX, pt.y, pt.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    else if (pt.type === 'spark') {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - cameraX, pt.y, pt.size, pt.size);
    }
    ctx.restore();
  });

  // 8. 노란색 플로팅 스코어 텍스트 (+10, +20, +500)
  floatingTexts.forEach(ft => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, ft.alpha);
    ctx.font = '16px "NeoDunggeunGothicPro"';
    ctx.fillStyle = '#ffcc00';
    ctx.fillText(ft.text, ft.x - cameraX, ft.y);
    ctx.restore();
  });

  // 9. 상단 통합 HUD
  if (gameState === 'PLAYING' || gameState === 'UPGRADE' || gameState === 'READY') {
    let heartStr = '';
    for (let i = 0; i < player.maxHearts; i++) {
      heartStr += i < player.hearts ? '❤️' : '🤍';
    }
    if (player.shield > 0) heartStr += ' 🛡️';

    ctx.font = '18px "NeoDunggeunGothicPro"';
    ctx.textAlign = 'left';
    ctx.fillText(heartStr, 20, 30);

    let speedMps = (player.speed * 3.0).toFixed(1);
    ctx.fillStyle = '#00e5ff';
    ctx.fillText(`속도: ${speedMps} m/s`, 220, 30);

    let paddedScore = String(score).padStart(6, '0');
    ctx.fillStyle = '#ffcc00';
    ctx.fillText(`점수: ${paddedScore} P`, 380, 30);

    let timerColor = timeLeft <= 30 ? '#ef4444' : '#ffffff';
    ctx.fillStyle = timerColor;
    ctx.textAlign = 'right';
    ctx.fillText(`⏳ ${Math.ceil(timeLeft)}초`, canvas.width - 20, 30);

    // 2열: 획득 버프 인벤토리 트레이 (업로드한 PNG 아이콘 우선 출력)
    let trayX = 20;
    for (let buffId in player.buffCounts) {
      let count = player.buffCounts[buffId];
      let iconImg = ASSETS.images['icon_' + buffId];
      let cardDef = CARD_POOL.find(c => c.id === buffId);

      if (iconImg && iconImg.complete && iconImg.naturalWidth > 0) {
        ctx.drawImage(iconImg, trayX, 42, 18, 18);
        ctx.fillStyle = '#8892b0';
        ctx.font = '14px "NeoDunggeunGothicPro"';
        ctx.textAlign = 'left';
        ctx.fillText(`×${count}`, trayX + 22, 56);
        trayX += 58;
      } else {
        let fallbackIcon = cardDef ? cardDef.icon : buffId;
        ctx.fillStyle = '#8892b0';
        ctx.font = '14px "NeoDunggeunGothicPro"';
        ctx.textAlign = 'left';
        let text = `[${fallbackIcon} ×${count}] `;
        ctx.fillText(text, trayX, 56);
        trayX += ctx.measureText(text).width + 6;
      }
    }

    ctx.font = '14px "NeoDunggeunGothicPro"';
    ctx.textAlign = 'right';
    if (player.skillTimer > 0) {
      ctx.fillStyle = '#888';
      ctx.fillText(`스킬(S): ${player.skillTimer.toFixed(1)}s`, canvas.width - 20, 56);
    } else {
      ctx.fillStyle = '#4ade80';
      ctx.fillText(`스킬(S): READY`, canvas.width - 20, 56);
    }
  }

  // 10. 레트로 텍스트 연출 (READY... GO! / WARNING!)
  if (gameState === 'READY') {
    ctx.font = '48px "NeoDunggeunGothicPro"';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffcc00';
    ctx.fillText('READY... GO!', canvas.width / 2, canvas.height / 2);
  }

  if (warningTimer > 0 && Math.floor(Date.now() / 200) % 2 === 0) {
    ctx.font = '36px "NeoDunggeunGothicPro"';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ef4444';
    ctx.fillText('WARNING!', canvas.width / 2, 70);
  }

  ctx.restore();
}

// --- 13. GIF 네이티브 실시간 애니메이션 DOM 동기화 엔진 ---
function getEntityLayer() {
  let layer = document.getElementById('entity-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'entity-layer';
    layer.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; overflow:hidden; z-index:5;';
    const container = document.getElementById('game-container');
    if (container) container.appendChild(layer);
  }
  return layer;
}

function syncEntityDOM(id, src, x, y, w, h, facing = 1, flash = false, visible = true, opacity = 1.0) {
  const layer = getEntityLayer();
  if (!layer) return;

  let el = document.getElementById(id);
  if (!visible) {
    if (el) el.style.display = 'none';
    return;
  }

  if (!el) {
    el = document.createElement('img');
    el.id = id;
    el.src = src;
    el.style.cssText = 'position:absolute; image-rendering:pixelated; image-rendering:crisp-edges; transform-origin:center center; will-change:transform,left,top;';
    el.onerror = () => { el.style.display = 'none'; };
    layer.appendChild(el);
  }

  el.style.display = 'block';
  el.style.left = (x / 900 * 100) + '%';
  el.style.top = (y / 500 * 100) + '%';
  el.style.width = (w / 900 * 100) + '%';
  el.style.height = (h / 500 * 100) + '%';
  el.style.transform = facing === -1 ? 'scaleX(-1)' : 'scaleX(1)';
  el.style.filter = flash ? 'brightness(3)' : 'none';
  el.style.opacity = opacity; // 반투명 적용
}

function removeEntityDOM(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function clearAllEntityDOM() {
  const layer = document.getElementById('entity-layer');
  if (layer) layer.innerHTML = '';
}

// --- 14. 점프 및 키보드/터치 입력 바인딩 ---
function triggerJump() {
  if (!player) return;
  if (keys.down) {
    player.ignorePlatformTimer = 0.4;
    player.vy = 6;
    player.isGrounded = false;
  } else if (player.isGrounded) {
    player.vy = -15.5;
    player.isGrounded = false;
  }
}

window.addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }

  if (e.code === 'ArrowLeft') keys.left = true;
  if (e.code === 'ArrowRight') keys.right = true;
  if (e.code === 'ArrowDown') {
    keys.down = true;
    if (player && player.isGrounded && player.y < FLOOR_2_Y) {
      triggerJump();
    }
  }
  if (e.code === 'ArrowUp') triggerJump();

  if (e.code === 'KeyA') doNormalAttack();
  if (e.code === 'KeyS') doSkill();
});

window.addEventListener('keyup', e => {
  if (e.code === 'ArrowLeft') keys.left = false;
  if (e.code === 'ArrowRight') keys.right = false;
  if (e.code === 'ArrowDown') keys.down = false;
});

// 모바일 가상 D-Pad 및 액션 버튼 이벤트 바인딩
function setupTouch(id, pressFn, releaseFn) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('touchstart', (e) => { e.preventDefault(); pressFn(); });
  el.addEventListener('touchend', (e) => { e.preventDefault(); if (releaseFn) releaseFn(); });
}

setupTouch('btn-m-left', () => keys.left = true, () => keys.left = false);
setupTouch('btn-m-right', () => keys.right = true, () => keys.right = false);
setupTouch('btn-m-up', () => triggerJump());
setupTouch('btn-m-down', () => {
  keys.down = true;
  if (player && player.isGrounded && player.y < FLOOR_2_Y) triggerJump();
}, () => keys.down = false);

setupTouch('btn-m-atk', () => doNormalAttack());
setupTouch('btn-m-skill', () => doSkill());
