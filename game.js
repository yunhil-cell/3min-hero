// =============================================================================
// [도전! 3분 용사] 게임 엔진 (game.js)
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
let bossBombs = []; // 스타 폭탄피하기 장판
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

function backToTitle() {
  document.getElementById('screen-select').style.display = 'none';
  document.getElementById('modal-result').style.display = 'none';
  document.getElementById('modal-records').style.display = 'none';
  document.getElementById('screen-title').style.display = 'flex';
  gameState = 'TITLE';
}

function selectChar(type, btn) {
  selectedChar = type;
  document.querySelectorAll('#screen-select .select-group')[0].querySelectorAll('.choice-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  checkDepartable();
}

function selectDiff(type, btn) {
  selectedDiff = type;
  document.querySelectorAll('#screen-select .select-group')[1].querySelectorAll('.choice-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  checkDepartable();
}

function checkDepartable() {
  if (selectedChar && selectedDiff) {
    document.getElementById('btn-depart').disabled = false;
  }
}

function showRules() {
  document.getElementById('modal-rules').style.display = 'flex';
}
function closeRules() {
  document.getElementById('modal-rules').style.display = 'none';
}

function openLeaderboard() {
  document.getElementById('modal-records').style.display = 'flex';
  if (window.loadLeaderboard) window.loadLeaderboard();
}
function closeLeaderboard() {
  document.getElementById('modal-records').style.display = 'none';
}

// --- 4. 게임 시작 및 초기화 ---
function startGame() {
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
  readyTimer = 1.2; // READY... GO! 연출 시간
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
        <div class="card-title">${card.icon} ${card.name}</div>
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
  player.buffCounts[icon] = (player.buffCounts[icon] || 0) + 1;

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

  monsters.push({
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
    warningTimer = 2.0; // WARNING 텍스트 점멸
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

  // 1. 플레이어 이동 및 달리기 관성
  if (keys.left) { player.vx = -player.speed; player.facing = -1; }
  else if (keys.right) { player.vx = player.speed; player.facing = 1; }
  else { player.vx = 0; }

  // 속도 통계 갱신
  let curSpeedMps = player.speed * 3.0;
  if (curSpeedMps > stats.maxSpeed) stats.maxSpeed = curSpeedMps;

  // 중력 및 위치 이동
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

  // 타이머 감소
  if (player.invincibleTimer > 0) player.invincibleTimer -= dt;
  if (player.skillTimer > 0) player.skillTimer -= dt;
  if (player.normalAtkTimer > 0) player.normalAtkTimer -= dt;
  if (player.swingTimer > 0) player.swingTimer -= dt;
  if (screenShakeTimer > 0) screenShakeTimer -= dt;
  if (warningTimer > 0) warningTimer -= dt;

  // 2. 카메라 제어 (보스 조우 시 화면 잠금)
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

  // 3. 거리 스폰 체크
  checkBossSpawn();
  let spawnInterval = getDiffSpawnDistance();
  if (player.x - lastDistanceSpawn >= spawnInterval && player.x < 1350 * SCALE_X) {
    spawnMonsterAtX(player.x + 850);
    lastDistanceSpawn = player.x;
  }

  // 4. 플레이어/적 투사체 이동 및 충돌
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

  // 5. 몬스터 액션 및 물리
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
          life: 3, isPlayer: false, isEmoji: true, emojiText: '🦴'
        });
      }
    }

    if (checkRectCollide(player, m)) hitPlayer();
    if (m.x < cameraX - 250) monsters.splice(i, 1);
  }

  // 6. 보스 패턴 및 스타 폭탄피하기 장판 처리
  updateBosses(dt);
  updateBossBombs(dt);

  // 7. 파티클 및 플로팅 스코어 갱신
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
  bossBombs.push({
    x: x,
    y: y,
    width: 64,
    height: 64,
    assetKey: assetKey,
    emoji: emoji,
    state: 'warning', // warning -> exploding -> dead
    timer: warningSec,
    explodeTimer: 0.9, // 900ms 12프레임 폭발 재생
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
        triggerScreenShake(0.1, 4); // 폭발 시 화면 흔들림
      }
    } else if (b.state === 'exploding') {
      b.explodeTimer -= dt;
      // 피격 판정 (지름 64px 원형)
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
      // [도미노 융단폭격] 1층 또는 2층 중 랜덤 선택 후 순차 폭발
      let targetFloorY = Math.random() < 0.5 ? FLOOR_1_Y : FLOOR_2_Y;
      let startX = d.x - 100;
      for (let k = 0; k < 4; k++) {
        let bombX = startX - (k * 130);
        let bombY = targetFloorY - 64;
        setTimeout(() => {
          if (gameState === 'PLAYING') spawnBossBomb(bombX, bombY, 'effect_fireball', '🔥', 0.6);
        }, k * 150); // 0.15초 도미노 간격
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
        // [직선 궤적 저격] 마왕 -> 플레이어 방향 3연속 연쇄 폭발
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
    triggerScreenShake(0.1, 5); // 치명타 적중 시 화면 흔들림
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
      height: player.height + 30
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
        life: 1.5, isPlayer: true, isExplosive: true, isEmoji: true, emojiText: '⚡', dmg: attackData.dmg, isCrit: attackData.isCrit
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
        life: 1.5, isPlayer: true, dmg: attackData.dmg, isCrit: attackData.isCrit, color: attackData.isCrit ? '#facc15' : '#e2e8f0'
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
      width: player.width + 120, height: player.height + 80
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
    let lightningArea = { x: lX, y: 0, width: 340, height: 500 };

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
          life: 1.5, isPlayer: true, dmg: attackData.dmg + 10, isCrit: attackData.isCrit, color: '#fb923c'
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

    if (b.type === 'dragon') {
      pendingUpgrades += 2;
      triggerUpgrade();
    } else if (b.type === 'demon') {
      endGame(true); // 마왕 토벌 성공
    }
  }
}

function hitPlayer() {
  if (player.invincibleTimer > 0) return;

  if (player.shield > 0) {
    player.shield = 0;
    player.invincibleTimer = 1.0; // 보호막 깨질 때도 1초 무적
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

  // 전투 리포트 HTML 작성
  let totalKills = stats.ghostKills + stats.zombieKills + stats.skeletonKills + stats.bossKills;
  document.getElementById('report-content').innerHTML = `
    • 잔여 시간 보너스 : ${Math.floor(timeLeft)}초 (+${timeBonus} P)<br>
    • 처치한 몬스터 : 총 ${totalKills}마리 (유령 ${stats.ghostKills}, 좀비 ${stats.zombieKills}, 스켈레톤 ${stats.skeletonKills}, 보스 ${stats.bossKills})<br>
    • 달성 최고 속도 : ${stats.maxSpeed.toFixed(1)} m/s<br>
    • 획득 버프 카드 : 총 ${stats.buffsCount}개<br>
    • 치명타 적중 횟수 : 총 ${stats.critHits}회
  `;

  // Firebase 실시간 TOP 3 자격 검증
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
  openLeaderboard(); // 바로 명예의 전당 열어서 확인
}
window.submitInitialScore = submitInitialScore;

// --- 11. 시각 효과 헬퍼 (레트로 셰이크/텍스트/파티클) ---
function triggerScreenShake(time, mag) {
  screenShakeTimer = time;
  screenShakeMag = mag;
}

function spawnFloatingText(x, y, text) {
  floatingTexts.push({ x, y, text, alpha: 1.0 });
}

function checkRectCollide(r1, r2) {
  return (r1.x < r2.x + r2.width &&
          r1.x + r1.width > r2.x &&
          r1.y < r2.y + r2.height &&
          r1.y + r1.height > r2.y);
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

// --- 12. 캔버스 렌더링 루프 ---
function render() {
  ctx.save();

  // 화면 흔들림(Screen Shake) 오프셋
  if (screenShakeTimer > 0) {
    let ox = (Math.random() - 0.5) * screenShakeMag * 2;
    let oy = (Math.random() - 0.5) * screenShakeMag * 2;
    ctx.translate(ox, oy);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. 3단계 거리별 배경 및 바닥 색상
  let curDist = player ? player.x / SCALE_X : 0;
  let skyColor = '#111827';
  let groundColor = '#22c55e'; // 1구간: 평원 초록

  if (curDist >= 1400) {
    skyColor = '#1a0b2e';       // 3구간: 마왕성 짙은 보라
    groundColor = '#581c87';
  } else if (curDist >= 600) {
    skyColor = '#2d150b';       // 2구간: 황무지 노을/붉은색
    groundColor = '#b45309';
  }

  ctx.fillStyle = skyColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 거리 표시선
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  for (let m = 0; m <= STAGE_LENGTH; m += 50) {
    let scrX = (m * SCALE_X) - cameraX;
    if (scrX >= -50 && scrX <= canvas.width + 50) {
      ctx.beginPath();
      ctx.moveTo(scrX, 0); ctx.lineTo(scrX, canvas.height);
      ctx.stroke();
    }
  }

  // 2층 발판 (상단)
  ctx.fillStyle = '#4b5563';
  ctx.fillRect(0, FLOOR_2_Y, canvas.width, 10);
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(0, FLOOR_2_Y, canvas.width, 3);

  // 1층 바닥 (하단)
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(0, FLOOR_1_Y, canvas.width, canvas.height - FLOOR_1_Y);
  ctx.fillStyle = groundColor;
  ctx.fillRect(0, FLOOR_1_Y, canvas.width, 5);

  // 2. 스타 폭탄피하기 장판 렌더링
  bossBombs.forEach(b => {
    let bx = b.x - cameraX;
    if (b.state === 'warning') {
      // 0.6초간 깜빡이는 붉은 경고 원 (지름 64px)
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
      // 900ms 12프레임 폭탄 폭발 GIF (없으면 이모지/원형 대체)
      ctx.save();
      if (ASSETS.images[b.assetKey]) {
        ctx.drawImage(ASSETS.images[b.assetKey], bx, b.y, b.width, b.height);
      } else {
        ctx.font = '40px "NeoDunggeunGothicPro", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.emoji, bx + 32, b.y + 32);
      }
      ctx.restore();
    }
  });

  // 3. 몬스터 렌더링 & [머리 위 숫자 체력 표기]
  monsters.forEach(m => {
    let sx = m.x - cameraX;
    ctx.save();
    if (m.hitFlash > 0) ctx.filter = 'brightness(3)';

    if (ASSETS.images[m.assetKey]) {
      ctx.drawImage(ASSETS.images[m.assetKey], sx, m.y, m.width, m.height);
    } else {
      ctx.font = '44px "NeoDunggeunGothicPro", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(m.emoji, sx + m.width / 2, m.y + m.height + 4);
    }
    ctx.restore();

    // 머리 위 정수 숫자 체력 표기
    ctx.font = '14px "NeoDunggeunGothicPro"';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ef4444';
    ctx.fillText(`HP ${m.hp}`, sx + m.width / 2, m.y - 8);
  });

  // 4. 보스 렌더링
  [bosses.dragon, bosses.demon].forEach(b => {
    if (b && b.active) {
      let bx = b.x - cameraX;
      ctx.save();
      if (b.hitFlash > 0) ctx.filter = 'brightness(3)';

      if (ASSETS.images[b.assetKey]) {
        ctx.drawImage(ASSETS.images[b.assetKey], bx, b.y, b.width, b.height);
      } else {
        ctx.font = '76px "NeoDunggeunGothicPro", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(b.emoji, bx + b.width / 2, b.y + b.height);
      }
      ctx.restore();

      // 상단 대형 보스 체력바
      ctx.fillStyle = '#000';
      ctx.fillRect(canvas.width/2 - 160, 20, 320, 16);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(canvas.width/2 - 160, 20, 320 * (b.hp / b.maxHp), 16);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(canvas.width/2 - 160, 20, 320, 16);
      
      ctx.fillStyle = '#fff';
      ctx.font = '14px "NeoDunggeunGothicPro"';
      ctx.textAlign = 'center';
      ctx.fillText(`보스 : ${b.name} (${b.hp} / ${b.maxHp})`, canvas.width/2, 33);
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

  // 6. 플레이어 렌더링 (보호막 버블 포함)
  if (player && (player.invincibleTimer <= 0 || Math.floor(Date.now() / 80) % 2 === 0)) {
    let px = player.x - cameraX;
    ctx.save();

    // 보호막 구체 버블 연출
    if (player.shield > 0) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px + player.width/2, player.y + player.height/2, 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.fill();
    }

    let heroKey = 'hero_' + selectedChar;
    if (ASSETS.images[heroKey]) {
      ctx.translate(px + player.width / 2, player.y + player.height / 2);
      if (player.facing === -1) ctx.scale(-1, 1);
      ctx.drawImage(ASSETS.images[heroKey], -player.width/2, -player.height/2, player.width, player.height);
    } else {
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
    // 1열: 하트 (❤️ / 🤍) 및 보호막 (🛡️)
    let heartStr = '';
    for (let i = 0; i < player.maxHearts; i++) {
      heartStr += i < player.hearts ? '❤️' : '🤍';
    }
    if (player.shield > 0) heartStr += ' 🛡️';

    ctx.font = '18px "NeoDunggeunGothicPro"';
    ctx.textAlign = 'left';
    ctx.fillText(heartStr, 20, 30);

    // 속도 (m/s)
    let speedMps = (player.speed * 3.0).toFixed(1);
    ctx.fillStyle = '#00e5ff';
    ctx.fillText(`속도: ${speedMps} m/s`, 220, 30);

    // 점수 (6자리 포맷)
    let paddedScore = String(score).padStart(6, '0');
    ctx.fillStyle = '#ffcc00';
    ctx.fillText(`점수: ${paddedScore} P`, 380, 30);

    // 제한 시간
    let timerColor = timeLeft <= 30 ? '#ef4444' : '#ffffff';
    ctx.fillStyle = timerColor;
    ctx.textAlign = 'right';
    ctx.fillText(`⏳ ${Math.ceil(timeLeft)}초`, canvas.width - 20, 30);

    // 2열: 획득 버프 인벤토리 트레이
    let buffStr = '';
    for (let icon in player.buffCounts) {
      buffStr += `[${icon} × ${player.buffCounts[icon]}] `;
    }
    if (buffStr) {
      ctx.font = '14px "NeoDunggeunGothicPro"';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#8892b0';
      ctx.fillText(buffStr, 20, 56);
    }

    // 스킬 쿨타임
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

// --- 13. 점프 및 키보드/터치 입력 바인딩 ---
function triggerJump() {
  if (!player) return;
  if (keys.down) {
    // 2층에서 하향 점프
    player.ignorePlatformTimer = 0.4;
    player.vy = 6;
    player.isGrounded = false;
  } else if (player.isGrounded) {
    // 1층 -> 2층으로 넉넉히 도약하는 점프력 (관성 유지)
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
    // 2층 발판에 있을 때만 하향 점프 발동 (1층에선 무시)
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

// 모바일 D-Pad 및 액션 버튼 이벤트 바인딩
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
