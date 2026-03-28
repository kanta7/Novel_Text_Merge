'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '.env') });
const fs = require('fs');

const BASE_DIR = __dirname;
const DEFAULT_DATA_DIR = path.join(BASE_DIR, 'Novel_data');
const DEFAULT_OUTPUT_DIR = path.join(BASE_DIR, 'output');

function printHelp() {
  console.log(`
使用法: node cli.js [オプション]

オプション:
  --folder NAME       処理するフォルダ名
  --data-dir PATH     小説フォルダの親ディレクトリ (デフォルト: ./Novel_data)
  --output-dir PATH   出力先ディレクトリ (デフォルト: ./output)
  --api-key KEY       Anthropic APIキー (省略時は環境変数 ANTHROPIC_API_KEY を使用)
  --model MODEL       使用するClaudeモデル (デフォルト: claude-sonnet-4-6)
  --list              利用可能なフォルダ一覧を表示して終了
  --help, -h          このヘルプを表示

使用例:
  node cli.js --list
  node cli.js --folder Novel1
  node cli.js --folder Novel1 --output-dir ./out
`);
}

function parseArgs(argv) {
  const args = {
    folder: null,
    dataDir: DEFAULT_DATA_DIR,
    outputDir: DEFAULT_OUTPUT_DIR,
    apiKey: null,
    model: 'claude-sonnet-4-6',
    list: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--folder':     args.folder    = argv[++i]; break;
      case '--data-dir':   args.dataDir   = path.resolve(argv[++i]); break;
      case '--output-dir': args.outputDir = path.resolve(argv[++i]); break;
      case '--api-key':    args.apiKey    = argv[++i]; break;
      case '--model':      args.model     = argv[++i]; break;
      case '--list':       args.list      = true; break;
      case '--help':
      case '-h':           args.help      = true; break;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const { listNovelFolders, getImagePaths } = require('./src/fileUtils');
  const { processFolder } = require('./src/processor');

  if (!fs.existsSync(args.dataDir)) {
    console.error(`エラー: データディレクトリが見つかりません: ${args.dataDir}`);
    process.exit(1);
  }

  const folders = listNovelFolders(args.dataDir);

  if (args.list || args.folder === null) {
    if (folders.length === 0) {
      console.log(`フォルダが見つかりません: ${args.dataDir}`);
    } else {
      console.log(`利用可能なフォルダ (${args.dataDir}):`);
      for (const fp of folders) {
        const name = path.basename(fp);
        try {
          const images = getImagePaths(fp);
          console.log(`  ${name}  (${images.length} 枚)`);
        } catch (err) {
          console.log(`  ${name}  (エラー: ${err.message})`);
        }
      }
    }
    if (args.folder === null) process.exit(0);
  }

  const folderPath = path.join(args.dataDir, args.folder);
  if (!fs.existsSync(folderPath)) {
    console.error(`エラー: フォルダが見つかりません: ${folderPath}`);
    process.exit(1);
  }

  const apiKey = args.apiKey || process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) {
    console.error(
      'エラー: Anthropic APIキーが設定されていません。\n' +
      '  --api-key オプションか環境変数 ANTHROPIC_API_KEY を設定してください。'
    );
    process.exit(1);
  }

  const pad = String(999).length;
  const progressCb = (current, total, filename) => {
    const p = String(total).length;
    process.stderr.write(`[${String(current).padStart(p)}/${total}] ${filename}\n`);
  };

  try {
    const outPath = await processFolder(folderPath, args.outputDir, apiKey, progressCb, args.model);
    console.log(`\n完了: ${outPath}`);
  } catch (err) {
    console.error(`エラー: ${err.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('予期しないエラー:', err);
  process.exit(1);
});
