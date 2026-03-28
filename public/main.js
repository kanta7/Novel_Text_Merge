const folderSelect = document.getElementById('folder-select');
const providerSelect = document.getElementById('provider-select');
const languageSelect = document.getElementById('language-select');
const btnStart = document.getElementById('btn-start');
const btnDownload = document.getElementById('btn-download');
const btnReset = document.getElementById('btn-reset');
const sectionSelect = document.getElementById('section-select');
const sectionProgress = document.getElementById('section-progress');
const sectionComplete = document.getElementById('section-complete');
const divider = document.getElementById('divider');
const progressBar = document.getElementById('progress-bar');
const progressCount = document.getElementById('progress-count');
const progressFilename = document.getElementById('progress-filename');
const progressFolderName = document.getElementById('progress-folder-name');
const badgeSkip = document.getElementById('badge-skip');
const errorSelect = document.getElementById('error-select');
const errorProcess = document.getElementById('error-process');
const completeMessage = document.getElementById('complete-message');

let currentFolder = '';
let eventSource = null;

// Load folder list on startup
async function loadFolders() {
  try {
    const res = await fetch('/api/folders');
    const data = await res.json();
    if (data.error) {
      showError(errorSelect, data.error);
      return;
    }
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

btnStart.addEventListener('click', () => {
  currentFolder = folderSelect.value;
  if (!currentFolder) return;

  hideError(errorSelect);
  hideError(errorProcess);
  btnStart.disabled = true;

  progressFolderName.textContent = currentFolder;
  progressCount.textContent = '0 / ?';
  progressBar.style.width = '0%';
  progressFilename.textContent = '処理中...';
  badgeSkip.style.display = 'none';
  badgeSkip.textContent = '';
  showState('progress');

  if (eventSource) {
    eventSource.close();
  }

  // Flag to prevent onerror from firing after normal completion
  let processingComplete = false;

  eventSource = new EventSource(`/api/process?folder=${encodeURIComponent(currentFolder)}&provider=${providerSelect.value}&language=${languageSelect.value}`);

  eventSource.onmessage = (e) => {
    let data;
    try {
      data = JSON.parse(e.data);
    } catch {
      return;
    }

    if (data.error) {
      processingComplete = true;
      eventSource.close();
      eventSource = null;
      showError(errorProcess, 'エラー: ' + data.error);
      showState(null);
      btnStart.disabled = false;
      return;
    }

    if (!data.done) {
      const pct = Math.round((data.current / data.total) * 100);
      progressBar.style.width = pct + '%';
      progressCount.textContent = `${data.current} / ${data.total}`;

      // スキップバッジ（再開時）
      if (data.skipped > 0) {
        badgeSkip.textContent = `↩ ${data.skipped}枚スキップ（再開）`;
        badgeSkip.style.display = '';
      } else {
        // 通常進捗はファイル名を表示
        progressFilename.textContent = data.filename;
      }
    } else {
      processingComplete = true;
      eventSource.close();
      eventSource = null;

      completeMessage.textContent = `テキスト抽出が完了しました！  (${data.total ?? ''} 枚処理)`;
      btnDownload.onclick = () => {
        window.location.href = `/api/download/${encodeURIComponent(currentFolder)}`;
      };
      showState('complete');
    }
  };

  eventSource.onerror = () => {
    // Ignore onerror if already completed or handled — server closing the connection
    // after sending done:true also triggers onerror in browsers.
    if (processingComplete) return;
    eventSource.close();
    eventSource = null;
    showError(errorProcess, 'サーバーへの接続に失敗しました。node server.js が起動しているか確認してください。');
    showState(null);
    btnStart.disabled = false;
  };
});

btnReset.addEventListener('click', () => {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  hideError(errorProcess);
  showState(null);
  btnStart.disabled = folderSelect.value === '';
});

loadFolders();
