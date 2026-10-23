import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Optional browser runner: the normal npm test suite has no browser dependency.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = process.env.AUDIT_OUTPUT || mkdtempSync(join(tmpdir(), 'tyov-record-sheet-'));
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
  args: ['--no-sandbox'],
});
const base = process.env.APP_URL || 'http://127.0.0.1:5176/';
const saveKey = 'athousandyearoldvampire_savegame';
const results = [];
const errors = [];
const labels = { play: '이야기 이어가기', memories: '기억과 경험', skills: '기술', resources: '자원',
  characters: '등장인물', marks: '표식', diary: '일기장', journal: '연대기', rules: '규칙 안내' };
const create = async (width = 1440) => {
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(10000);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  return page;
};
async function utility(page, label) {
  if (page.viewportSize().width <= 700) {
    const menu = page.locator('.mobile-tools');
    if ((await menu.getAttribute('open')) === null) await menu.locator('summary').click();
    await menu.getByRole('button', { name: label, exact: true }).click();
  } else await page.locator('.sidebar-footer').getByRole('button', { name: label, exact: true }).click();
}
async function nav(page, target) {
  if (page.viewportSize().width <= 700) {
    if (target === 'play' || target === 'journal') {
      await page.locator('.mobile-navigation nav').getByRole('button', { name: target === 'play' ? '이야기' : '연대기', exact: true }).click();
    } else if (target === 'rules') await utility(page, '규칙 안내');
    else {
      await page.locator('.mobile-navigation nav').getByRole('button', { name: '기록표', exact: true }).click();
      await page.getByLabel('기록표 항목', { exact: true }).selectOption(target);
    }
  } else if (target === 'rules') await utility(page, '규칙 안내');
  else await page.locator('.nav-list').getByRole('button', { name: new RegExp(`^${labels[target]}`) }).click();
}
const state = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), saveKey);
const applyDialog = page => page.getByRole('dialog').getByRole('button', { name: '적용하기', exact: true }).click();
const current = page => page.locator('.record-collection > .trait-grid');
const card = (root, id) => root.locator(`[data-record-id="${id}"]`);
async function load(page, data) {
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: saveKey, data });
  await page.reload({ waitUntil: 'domcontentloaded' });
}
async function capture(page, filename) {
  await page.evaluate(async () => { window.scrollTo(0, 0); await document.fonts.ready; await new Promise(requestAnimationFrame); });
  await page.screenshot({ path: join(output, filename), fullPage: true });
}
try {
  const p = await create();
  assert.equal(await p.getByLabel(/^기술 [123]$/).count(), 3);
  assert.equal(await p.getByLabel(/^자원 [123]$/).count(), 3);
  await p.getByLabel('자원 1', { exact: true }).pressSequentially('강가의 작은 집');
  assert.equal(await p.getByLabel('자원 1', { exact: true }).inputValue(), '강가의 작은 집');
  await p.getByRole('checkbox', { name: /정착 자원/ }).first().check();
  await p.getByLabel('자원 1', { exact: true }).fill('');
  await p.getByLabel('자원 1', { exact: true }).pressSequentially('오래된 강가의 집');
  assert.equal(await p.getByLabel('자원 1', { exact: true }).inputValue(), '오래된 강가의 집');
  await p.getByLabel('기술 2', { exact: true }).fill('약초 다루기');
  await p.reload();
  assert.equal(await p.getByLabel('기술 2', { exact: true }).inputValue(), '약초 다루기');
  assert.equal(await p.getByLabel('자원 1', { exact: true }).inputValue(), '오래된 강가의 집');
  await p.getByRole('button', { name: '예시 인물로 채워 보기' }).click();
  await applyDialog(p);
  await p.getByLabel('자원 1', { exact: true }).fill('');
  await p.getByLabel('자원 1', { exact: true }).pressSequentially('강가의 작은 집');
  await p.getByRole('checkbox', { name: /정착 자원/ }).first().check();
  await p.getByRole('button', { name: '필멸자 한 명 더' }).click();
  await p.getByLabel('필멸자 4', { exact: true }).fill('새벽: 기억을 잇는 제자');
  await capture(p, 'creation-desktop.png');
  await p.getByRole('button', { name: '첫 번째 밤으로' }).click();
  const seed = await state(p);
  assert.equal(seed.skills.length, 3);
  assert.equal(seed.resources.length, 3);
  assert.equal(seed.resources[0].name, '강가의 작은 집');
  assert.equal(seed.resources[0].isStationary, true);
  assert.equal(seed.characters.filter(c => c.type === 'mortal').length, 4);
  results.push('개별 세 칸·필멸자 추가·일반/정착 자원 키보드 공백·새로고침 저장');

  await nav(p, 'skills');
  assert.equal(await current(p).locator('.trait-slot').count(), 3);
  const skillId = seed.skills[0].id;
  await card(current(p), skillId).getByRole('button', { name: '체크', exact: true }).click();
  await p.waitForFunction(() => document.activeElement?.matches('.trait-slot.checked'));
  assert.equal(await card(current(p), skillId).locator('.entity-title').evaluate(x => getComputedStyle(x).textDecorationLine), 'none');
  await card(current(p), skillId).getByRole('button', { name: '잃기', exact: true }).click();
  await p.getByRole('dialog').getByRole('button', { name: '취소', exact: true }).click();
  assert.equal((await state(p)).skills[0].isLost, undefined);
  await card(current(p), skillId).getByRole('button', { name: '잃기', exact: true }).click();
  await applyDialog(p);
  assert.equal(await card(current(p), skillId).count(), 0);
  assert.equal(await current(p).locator('.empty-trait').count(), 1);
  assert.equal((await state(p)).skills.length, 3);
  assert.equal((await state(p)).skills[0].isChecked, true);
  for (const title of ['네 번째 기술', '다섯 번째 기술']) {
    await p.getByRole('button', { name: '기술 추가', exact: true }).click();
    await p.getByLabel('이름과 설명').fill(title);
    await p.getByRole('button', { name: '기록하기', exact: true }).click();
  }
  assert.equal(await current(p).locator('article').count(), 4);
  await p.reload();
  await nav(p, 'skills');
  assert.equal(await current(p).locator('article').count(), 4);
  await p.locator('.lost-records > summary').click();
  assert.equal(await p.locator('.lost-records').getByRole('button', { name: '지시에 따라 복구' }).count(), 0);
  await p.getByRole('checkbox', { name: /현재 사건이 기억/ }).check();
  await p.locator('.lost-records').getByRole('button', { name: '지시에 따라 복구' }).click();
  assert.equal(await current(p).locator('article').count(), 5);
  assert.equal((await state(p)).skills[0].id, skillId);
  assert.equal((await state(p)).skills[0].isChecked, true);
  assert.equal(await card(current(p), skillId).getByRole('button', { name: '체크', exact: true }).count(), 0);
  await capture(p, 'skills-desktop.png');
  results.push('사용/상실 구별·확인 취소·현재 칸에서 소실·네 번째 이후 획득·동일 ID/사용 상태 복구');

  await nav(p, 'play');
  await p.getByRole('button', { name: '기술 기록표', exact: true }).click();
  let selected = p.getByRole('tab', { selected: true });
  assert.match(await selected.innerText(), /기술/);
  await p.waitForFunction(() => document.activeElement?.matches('[role="tab"][aria-selected="true"]'));
  await selected.press('ArrowRight');
  selected = p.getByRole('tab', { selected: true });
  assert.match(await selected.innerText(), /자원/);
  await selected.press('Home');
  assert.match(await p.getByRole('tab', { selected: true }).innerText(), /기억/);
  await p.getByRole('tab', { selected: true }).press('End');
  assert.match(await p.getByRole('tab', { selected: true }).innerText(), /자원/);
  const resourceId = seed.resources[0].id;
  await card(p.getByRole('tabpanel'), resourceId).getByRole('button', { name: '잃기', exact: true }).click();
  await applyDialog(p);
  assert.equal(await card(p.getByRole('tabpanel'), resourceId).count(), 0);
  assert.equal((await state(p)).resources.find(r => r.id === resourceId).isLost, true);
  assert.match(await p.locator('h1').innerText(), /이야기/);
  results.push('사건을 유지하는 곁 기록표·바로가기 초점·탭 화살표/Home/End·자원 상실');

  await nav(p, 'memories');
  assert.equal(await p.locator('.memory-grid > div').first().locator('.experience-item').count(), 3);
  await p.getByRole('button', { name: '이 기억에 경험 쓰기' }).nth(1).click();
  await p.waitForFunction(() => document.activeElement?.matches('.journal-editor textarea:not(.journal-textarea)'));
  assert.equal(await p.getByLabel('어느 기억에 담을까요?').inputValue(), seed.memories[1].id);
  await p.getByLabel('어떤 일이 있었나요?').fill('밤은 끝없이 이어졌다. 누이의 이름만이 내 안에 남았다.');
  await p.getByLabel(/기억에 남길 한 문장/).fill('나는 이름을 불렀다; 대답은 들려오지 않았다.');
  await p.reload();
  assert.match(await p.getByLabel('어떤 일이 있었나요?').inputValue(), /누이/);
  await p.getByRole('checkbox', { name: /사건이 지시한 모든 변화/ }).check();
  await p.getByRole('button', { name: '이번 사건 마치기' }).click();
  assert.equal((await state(p)).journal.length, 1);
  await p.getByRole('button', { name: '주사위 굴리기' }).click();
  await p.waitForFunction(key => !!JSON.parse(localStorage.getItem(key)).lastRoll, saveKey);
  results.push('기억의 경험 세 자리·선택 기억에서 글쓰기·초안 복원·기록 완료·이동');

  await nav(p, 'memories');
  await p.getByRole('button', { name: '일기장에 옮기기', exact: true }).first().click();
  const diaryId = (await state(p)).diaryResourceId;
  await nav(p, 'resources');
  await card(current(p), diaryId).getByRole('button', { name: '책 열기', exact: true }).click();
  assert.match(await p.locator('h1').innerText(), /종이/);
  await nav(p, 'resources');
  await card(current(p), diaryId).getByRole('button', { name: '잃기', exact: true }).click();
  assert.match(await p.getByRole('dialog').innerText(), /모든 기억/);
  await applyDialog(p);
  assert.ok((await state(p)).diary.every(d => d.isLost));
  results.push('일기장 자원의 별도 칸·책 열기·분실 시 연결 기억 소실');

  await nav(p, 'characters');
  await p.getByRole('checkbox', { name: /현재 사건이 기억/ }).uncheck();
  const characterId = seed.characters[0].id;
  await p.locator('.record-collection [data-record-id]').filter({ has: p.getByText(seed.characters[0].name, { exact: true }) }).getByRole('button', { name: '죽음 표시', exact: true }).click();
  await applyDialog(p);
  await p.locator('.lost-records > summary').click();
  assert.equal(await p.locator('.lost-records').getByRole('button', { name: '지시에 따라 복구' }).count(), 0);
  await p.getByRole('checkbox', { name: /현재 사건이 기억/ }).check();
  await p.locator('.lost-records').getByRole('button', { name: '지시에 따라 복구' }).click();
  assert.equal((await state(p)).characters.find(c => c.id === characterId).isAlive, true);
  await nav(p, 'marks');
  await p.getByRole('checkbox', { name: /현재 사건이 기억/ }).uncheck();
  assert.equal(await current(p).getByRole('button', { name: '잃기', exact: true }).isDisabled(), true);
  await p.getByRole('checkbox', { name: /현재 사건이 기억/ }).check();
  await current(p).getByRole('button', { name: '잃기', exact: true }).click();
  await applyDialog(p);
  assert.equal(await current(p).locator('article').count(), 0);
  assert.equal(await current(p).locator('.empty-trait').count(), 1);
  results.push('필멸/불멸 구획·인물 복귀 권한·표식의 지시 모드와 소실');

  const long = await state(p);
  long.skills.push({ id: 'long-title', name: '긴기술LongUnbrokenName'.repeat(45), isChecked: false });
  long.characterName = '오래된이름 UnbrokenVampireName'.repeat(15);
  long.memories[0].label = '주제가아주긴기억LongMemoryTheme'.repeat(10);
  long.memories[0].maxExperiences = 1000000;
  long.memories[0].experiences = [{ id: 'long-experience', text: '긴경험LongUnbrokenText'.repeat(70) }];
  await load(p, long);
  for (const width of [1440, 1024, 768, 390, 320]) {
    await p.setViewportSize({ width, height: 1000 });
    for (const target of Object.keys(labels)) {
      await nav(p, target);
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width} ${target}: horizontal overflow`);
    }
  }
  results.push('9화면 × 1440/1024/768/390/320px·긴 한영 제목/경험·큰 기억 용량');
  await p.close();

  const mobile = await create(390);
  await load(mobile, seed);
  await capture(mobile, 'play-mobile.png');
  await mobile.getByRole('button', { name: /기록표 펼치기/ }).click();
  await mobile.getByRole('tab', { name: /^기술/ }).click();
  assert.equal(await mobile.getByRole('tabpanel').locator('article').count(), 3);
  await nav(mobile, 'skills');
  await capture(mobile, 'skills-mobile.png');
  await mobile.locator('.mobile-tools > summary').click();
  await mobile.keyboard.press('Escape');
  assert.equal(await mobile.locator('.mobile-tools').getAttribute('open'), null);
  await utility(mobile, '기기 복구함');
  assert.equal(await mobile.getByRole('dialog').count(), 1);
  await mobile.keyboard.press('Escape');
  await nav(mobile, 'play');
  await mobile.getByRole('button', { name: '기술 기록표', exact: true }).click();
  await mobile.waitForFunction(() => document.activeElement?.matches('[role="tab"][aria-selected="true"]'));
  results.push('모바일 기록표 펼침·항목 전환·보관 메뉴·바로가기 초점');
  await mobile.close();

  const ended = await create(390);
  await load(ended, { ...seed, skills: [], resources: [] });
  await nav(ended, 'skills');
  await ended.getByRole('button', { name: '기술 체크 비용 지불' }).click();
  await ended.getByRole('button', { name: '최후를 맞이하기' }).click();
  assert.equal((await state(ended)).isGameOver, true);
  assert.equal(await ended.getByRole('button', { name: '기술 추가', exact: true }).isDisabled(), true);
  assert.ok((await ended.locator('.empty-trait').all()).length === 3);
  assert.ok((await Promise.all((await ended.locator('.empty-trait').all()).map(item => item.isDisabled()))).every(Boolean));
  await ended.getByRole('button', { name: '최후의 이야기 기록' }).click();
  await ended.getByLabel('이야기', { exact: true }).fill('마지막으로 나는 내 이름을 잊었다.');
  await ended.getByRole('button', { name: '기록 갱신' }).click();
  assert.equal((await state(ended)).gameOverText, '마지막으로 나는 내 이름을 잊었다.');
  await ended.close();
  results.push('모든 비용 소진의 최후·끝난 기록표 비활성·최후 글 수정');

  const exports = await create();
  await load(exports, seed);
  await exports.getByRole('button', { name: '내보내기', exact: true }).click();
  let pending = exports.waitForEvent('download');
  await exports.getByRole('button', { name: 'JSON 백업 다운로드' }).click();
  await (await pending).saveAs(join(output, 'record.json'));
  assert.equal(JSON.parse(readFileSync(join(output, 'record.json'), 'utf8')).skills.length, 3);
  pending = exports.waitForEvent('download');
  await exports.getByRole('button', { name: 'Markdown 읽기 문서' }).click();
  await (await pending).saveAs(join(output, 'record.md'));
  assert.match(readFileSync(join(output, 'record.md'), 'utf8'), /강가의 작은 집/);
  await exports.keyboard.press('Escape');
  await exports.locator('input[type=file]').setInputFiles(join(output, 'record.json'));
  await applyDialog(exports);
  assert.equal((await state(exports)).resources[0].isStationary, true);
  await nav(exports, 'skills');
  await capture(exports, 'final-skills-desktop.png');
  const fonts = await exports.evaluate(async () => { await document.fonts.ready; return [...document.fonts].map(f => ({ family: f.family, status: f.status })); });
  assert.ok(fonts.every(font => font.status === 'loaded'));
  assert.equal(await exports.locator('img').count(), 0);
  await exports.close();
  results.push('JSON/Markdown 다운로드·기존 형식 재가져오기·3개 폰트 로드·이미지 없음');
  assert.deepEqual(errors, []);
  writeFileSync(join(output, 'results.json'), JSON.stringify({ results, errors }, null, 2));
  console.log(JSON.stringify({ passed: true, output, results, errors }));
} finally { await browser.close(); }
