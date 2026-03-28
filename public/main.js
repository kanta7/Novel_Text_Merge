const folderSelect       = document.getElementById('folder-select');
const providerSelect     = document.getElementById('provider-select');
const languageSelect     = document.getElementById('language-select');
const mergeSelect        = document.getElementById('merge-select');
const btnStart           = document.getElementById('btn-start');
const btnDownload        = document.getElementById('btn-download');
const btnReset           = document.getElementById('btn-reset');
const sectionSelect      = document.getElementById('section-select');
const sectionProgress    = document.getElementById('section-progress');
const sectionComplete    = document.getElementById('section-complete');
const divider            = document.getElementById('divider');
const progressBar        = document.getElementById('progress-bar');
const progressCount      = document.getElementById('progress-count');
const progressFilename   = document.getElementById('progress-filename');
const progressFolderName = document.getElementById('progress-folder-name');
const badgeSkip          = document.getElementById('badge-skip');
const badgeParallel      = document.getElementById('badge-parallel');
const badgeMerge         = document.getElementById('badge-merge');
const errorSelect        = document.getElementById('error-select');
const errorProcess       = document.getElementById('error-process');
const completeMessage    = document.getElementById('complete-message');
// Error toggle (complete section)
const btnErrorToggle     = document.getElementById('btn-error-toggle');
const errorToggleCount   = document.getElementById('error-toggle-count');
const errorDetailBox     = document.getElementById('error-detail-box');
const errorDetailList    = document.getElementById('error-detail-list');
// History
const historyList        = document.getElementById('history-list');
const btnClearHistory    = document.getElementById('btn-clear-history');

let currentFolder = '';
let eventSource   = null;

// ── Folder list ───────────────────────────────────────────

async function loadFolders() {
  try {
    const res  = await fetch('/api/folders');
    const data = await res.json();
    if (data.error) { showError(errorSelect, data.error); return; }
    folderSelect.innerHTML = '';
    if (data.folders.length === 0) {
      folderSelect.innerHTML = '<option value="">フォルダが見つかりません</option>';
      return;
    }
    data.folders.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.name;
      opt.textContent = f.count !== null ? `${f.name}  (${f.count} 枚)` : f.name;
      folderSelect.appendChild(opt);
    });
    btnStart.disabled = false;
  } catch (e) {
    showError(errorSelect, 'フォルダ一覧の取得に失敗しました: ' + e.message);
  }
}

// ── UI helpers ────────────────────────────────────────────

function showError(el, msg) {
  el.textContent = msg;
  el.classList.add('active');
}

function hideError(el) {
  el.textContent = '';
  el.classList.remove('active');
}

function showState(state) {
  sectionProgress.classList.remove('active');
  sectionComplete.classList.remove('active');
  divider.style.display = 'none';
  if (state === 'progress') {
    divider.style.display = '';
    sectionProgress.classList.add('active');
  } else if (state === 'complete') {
    divider.style.display = '';
    sectionComplete.classList.add('active');
  }
}

/** 完了画面のエラートグルをリセット */
function resetErrorToggle() {
  btnErrorToggle.style.display = 'none';
  errorDetailBox.style.display = 'none';
  errorDetailList.innerHTML    = '';
  errorToggleCount.textContent = '0';
}

// ── History ───────────────────────────────────────────────

async function loadHistory() {
  try {
    const res  = await fetch('/api/history');
    const data = await res.json();
    renderHistory(data.history || []);
  } catch {
    renderHistory([]);
  }
}

function renderHistory(entries) {
  historyList.innerHTML = '';
  if (entries.length === 0) {
    const p = document.createElement('p');
    p.className = 'history-empty';
    p.textContent = '履歴はありません';
    historyList.appendChild(p);
    return;
  }

  entries.forEach(entry => {
    const hasErrors = entry.errors && entry.errors.length > 0;
    const det = document.createElement('details');
    det.className = 'history-entry' + (hasErrors ? ' has-errors' : '');

    let dateStr = '';
    try { dateStr = new Date(entry.timestamp).toLocaleString('ja-JP'); } catch {}

    const provLabel = { anthropic: 'Claude', openai: 'GPT-4o', google: 'Gemini' }[entry.provider] || entry.provider;
    const metaText  = `${dateStr}　${entry.total}枚　${provLabel} / ${entry.model}　${entry.language === 'ja' ? '日本語' : 'English'}`;
    const badgeTxt  = hasErrors ? `${entry.errors.length}件エラー` : '完了';
    const badgeCls  = hasErrors ? 'he-badge badge-err' : 'he-badge badge-ok';

    det.innerHTML = `
      <summary>
        <span class="he-icon">${hasErrors ? '⚠️' : '✅'}</span>
        <div class="he-info">
          <span class="he-folder">${escHtml(entry.folder)}</span>
          <span class="he-meta">${escHtml(metaText)}</span>
        </div>
        <span class="${badgeCls}">${badgeTxt}</span>
      </summary>`;

    if (hasErrors) {
      const detail = document.createElement('div');
      detail.className = 'he-detail';
      const ul = document.createElement('ul');
      ul.className = 'he-error-list';
      entry.errors.forEach(e => {
        const li = document.createElement('li');
        li.textContent = `${e.filename}:  ${e.message}`;
        ul.appendChild(li);
      });
      detail.appendChild(ul);
      det.appendChild(detail);
    }

    historyList.appendChild(det);
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Error toggle button ───────────────────────────────────

btnErrorToggle.addEventListener('click', () => {
  const isOpen = errorDetailBox.style.display !== 'none';
  errorDetailBox.style.display = isOpen ? 'none' : '';
  btnErrorToggle.textContent = '';
  const countSpan = document.createElement('span');
  countSpan.id = 'error-toggle-count';
  countSpan.textContent = errorToggleCount.textContent;
  btnErrorToggle.textContent = isOpen
    ? `⚠️ エラー詳細を見る（${errorToggleCount.textContent}件）`
    : `⚠️ エラー詳細を閉じる（${errorToggleCount.textContent}件）`;
});

// ── Start button ──────────────────────────────────────────

btnStart.addEventListener('click', () => {
  currentFolder = folderSelect.value;
  if (!currentFolder) return;

  hideError(errorSelect);
  hideError(errorProcess);
  resetErrorToggle();
  btnStart.disabled = true;

  progressFolderName.textContent = currentFolder;
  progressCount.textContent      = '0 / ?';
  progressBar.style.width        = '0%';
  progressFilename.textContent   = '処理中...';
  badgeSkip.style.display        = 'none';
  badgeSkip.textContent          = '';
  badgeParallel.style.display    = '';
  badgeMerge.style.display       = 'none';
  showState('progress');

  if (eventSource) eventSource.close();

  let processingComplete = false;

  const joinLines = document.querySelector('input[name="join-lines"]:checked').value === 'yes';

  eventSource = new EventSource(
    `/api/process?folder=${encodeURIComponent(currentFolder)}&provider=${providerSelect.value}&language=${languageSelect.value}&merge=${mergeSelect.value}&joinLines=${joinLines}`
  );

  eventSource.onmessage = (e) => {
    let data;
    try { data = JSON.parse(e.data); } catch { return; }

    if (data.error) {
      processingComplete = true;
      eventSource.close();
      eventSource = null;
      showError(errorProcess, 'エラー: ' + data.error);
      showState(null);
      btnStart.disabled = false;
      return;
    }

    if (data.mergeStep) {
      // 結合ステップの進捗
      const pct = Math.round((data.current / data.total) * 100);
      progressBar.style.width   = pct + '%';
      progressCount.textContent = `結合中: ${data.current} / ${data.total}`;
      badgeParallel.style.display = 'none';
      badgeMerge.style.display    = '';
      progressFilename.textContent = '';
    } else if (!data.done) {
      // 並列処理ステップの進捗
      const pct = Math.round((data.current / data.total) * 100);
      progressBar.style.width        = pct + '%';
      progressCount.textContent      = `${data.current} / ${data.total}`;

      if (data.skipped > 0) {
        badgeSkip.textContent  = `↩ ${data.skipped}枚スキップ（再開）`;
        badgeSkip.style.display = '';
      } else {
        progressFilename.textContent = data.filename;
      }
    } else {
      processingComplete = true;
      eventSource.close();
      eventSource = null;

      const errCount = data.errors ? data.errors.length : 0;

      if (data.mergeSkipped) {
        // 結合なし完了
        completeMessage.textContent = `文章化が完了しました（${data.total ?? ''}枚 / 個別ファイルは output フォルダに保存）`;
        btnDownload.style.display = 'none';
        if (errCount > 0) {
          errorToggleCount.textContent = errCount;
          errorDetailList.innerHTML = '';
          data.errors.forEach(err => {
            const li = document.createElement('li');
            li.textContent = `${err.filename}:  ${err.message}`;
            errorDetailList.appendChild(li);
          });
          btnErrorToggle.textContent   = `⚠️ エラー詳細を見る（${errCount}件）`;
          btnErrorToggle.style.display = '';
          errorDetailBox.style.display = 'none';
        } else {
          resetErrorToggle();
        }
      } else if (errCount > 0) {
        // 結合あり・エラーあり
        completeMessage.textContent      = `変換完了（${data.total ?? ''}枚処理 / ${errCount}件エラー）`;
        errorToggleCount.textContent     = errCount;
        errorDetailList.innerHTML        = '';
        data.errors.forEach(err => {
          const li = document.createElement('li');
          li.textContent = `${err.filename}:  ${err.message}`;
          errorDetailList.appendChild(li);
        });
        btnErrorToggle.textContent   = `⚠️ エラー詳細を見る（${errCount}件）`;
        btnErrorToggle.style.display = '';
        errorDetailBox.style.display = 'none';
        btnDownload.style.display = '';
        btnDownload.onclick = () => {
          window.location.href = `/api/download/${encodeURIComponent(currentFolder)}`;
        };
      } else {
        // 結合あり・エラーなし
        completeMessage.textContent  = `テキスト抽出が完了しました！  (${data.total ?? ''} 枚処理)`;
        resetErrorToggle();
        btnDownload.style.display = '';
        btnDownload.onclick = () => {
          window.location.href = `/api/download/${encodeURIComponent(currentFolder)}`;
        };
      }

      showState('complete');
      loadHistory();
    }
  };

  eventSource.onerror = () => {
    if (processingComplete) return;
    eventSource.close();
    eventSource = null;
    showError(errorProcess, 'サーバーへの接続に失敗しました。node server.js が起動しているか確認してください。');
    showState(null);
    btnStart.disabled = false;
  };
});

// ── Reset button ──────────────────────────────────────────

btnReset.addEventListener('click', () => {
  if (eventSource) { eventSource.close(); eventSource = null; }
  hideError(errorProcess);
  resetErrorToggle();
  btnDownload.style.display = '';
  showState(null);
  btnStart.disabled = folderSelect.value === '';
});

// ── Clear history button ──────────────────────────────────

btnClearHistory.addEventListener('click', async () => {
  if (!confirm('変換履歴をすべて削除しますか？')) return;
  try {
    await fetch('/api/history', { method: 'DELETE' });
    await loadHistory();
  } catch (e) {
    console.error('履歴クリア失敗:', e);
  }
});

// ── Init ──────────────────────────────────────────────────

loadFolders();
loadHistory();
