import * as vscode from "vscode";
import { exec, ExecOptions } from "node:child_process";
import { ObjectEncodingOptions } from "node:fs";
import { FileHandle, open } from "node:fs/promises";

const ORGS_SECRET_STORAGE_KEY = 'taurify-orgs';

// debugging; TODO: remove
(globalThis as any).vscode = vscode;

const blocks = " ▏▎▍▌▋▊▉▉▉";

let statusBarItem: vscode.StatusBarItem;

const outputChannel = vscode.window.createOutputChannel("Taurify");

function escapeAttr(text: string) {
  return text.replace(/(?:^|[^\\])(?:\\\\)*\\"/g, '\\"');
}

function escapeHtml(text: string) {
  return text.replace(/</g, '&lt;');
}

function createInitViewHTML(orgs: Record<string, string>, paths: string[]) {
  const scriptNonce = getNonce();
  const styleNonce = getNonce();
  return `<!doctype html>
<html>
<head>
  <title>Taurify: Initialization</title>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${styleNonce}'; script-src 'nonce-${scriptNonce}';" />
  <style type="text/css" nonce="${styleNonce}">
    ul { list-style: none; padding: 0; }
    h2 { padding: 10px 0px 0px 10px; }
    li { padding: 10px; }
    label { display: block; font-weight: 600; }
    label + p { margin-bottom: 15px; }
    fieldset { border: 0; padding: 0; }
    fieldset label { display: inline-block; }
    fieldset label + label { margin-left: 10px; }
    input[type="text"], input[type="password"], textarea { min-width: 16rem; }
    input[type="checkbox"] {
      appearance: none;
      border: none;
      background: inherit;
      width: 1.2rem;
      height: 1.2rem;
      background: var(--vscode-settings-textInputBackground, inherit);
      display: inline-block;
      vertical-align: -0.5rem;
    }
    input[type="checkbox"]:checked::before {
      content: '\\2713';
      position: absolute;
      margin: -0.1rem 0 0 -0.1rem;
    }
    input, select, textarea { background: var(--vscode-settings-textInputBackground, inherit); color: inherit; border: none; padding: 4px 6px; }
    input:focus, select:focus, textarea:focus { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
    button { background: var(--vscode-button-background, inherit); color: inherit; border: none; padding: 4px; font: inherit; }
    #orgs span { margin-right: 10px; }
  </style>
</head>
<body>
  <h2>Taurify: Initialization</h2>
  <form id="init-form">
    <ul id="init">
      <li>
        <label for="project-path">Project path</label>
        <p>The path of the project that should be taurified.</p>
        <select id="project-path" name="projectPath">
          ${paths.map((path) => 
            `<option value="${escapeAttr(path)}">
              ${escapeHtml(path)}
            </option>`).join('\n')}
        </select>
      </li>
      <li>
        <label for="product-name">Product name</label>
        <p>The name of the product (used as application title).</p>
        <input type="text" id="product-name" name="productName" required />
      </li>
      <li>
        <label for="identifier">Canonical identifier</label>
        <p>A canonical identifier for the product, e.g. com.mycompany.myapp.</p>
        <input type="text" id="identifier" name="identifier" pattern="(\\w+\\.){2,}\\w+" required />
      </li>
      <li>
        <label for="app-slug">Application slug</label>
        <p>The identifier for the application in your Cloud account.</p>
        <input type="text" id="app-slug" name="appSlug" required />
      </li>
      <li>
        <label for="org-slug">Organization slug</label>
        <p>The identifier for the organization in your Cloud account. You can <a href="#new-org-slug">add organizations</a> below.</p>
        <select id="org-slug" name="orgSlug" placeholder="No orgs configured" required>
          <option id="no-orgs" value="">Please add your organization below</option>
        </select>
      </li>
      <li>
        <label for="platforms">Platforms</label>
        <p>The platform(s) for which binaries should be created.</p>
        <fieldset id="platforms">
          <label for="platform-mac">Mac OS
            <input type="checkbox" id="platform-mac" name="platforms" value="mac" />
          </label>
          <label for="platform-windows">Windows
            <input type="checkbox" id="platform-windows" name="platforms" value="win" />
          </label>
          <label for="platform-linux">Linux
            <input type="checkbox" id="platform-linux" name="platforms" value="linux" />
          </label>
          <label for="platform-ios">iOS
            <input type="checkbox" id="platform-ios" name="platforms" value="ios" />
          </label>
          <label for="platform-android">Android
            <input type="checkbox" id="platform-android" name="platforms" value="android" />
          </label>
        </fieldset>
      </li>
      <li>
        <label for="package-manager">Package manager</label>
        <p>The package manager your front-end uses.</p>
        <select id="package-manager" name="packageManager">
          <option value="npm">npm</option>
          <option value="pnpm">pnpm</option>
          <option value="yarn">yarn</option>
        </select>
      </li>
      <li>
        <label for="password">Password</label>
        <p>A hidden passphrase to create a key pair for your application to sign updates.</p>
        <input type="password" id="password" name="password" required />
      </li>
      <li>
        <label for="run-before-dev">Run before dev</label>
        <p>The script to run (e.g. <code>npm run dev</code>) before dev is started.</p>
        <textarea id="run-before-dev" name="runBeforeDev"></textarea>
      </li>
      <li>
        <label for="run-before-build">Run before build</label>
        <p>The script to run (e.g. <code>npm run build</code>) before dev is started.</p>
        <textarea id="run-before-build" name="runBeforeBuild"></textarea>
      </li>
      <li>
        <label for="bootstrap">
          <input type="checkbox" id="bootstrap" name="bootstrap" value="true" />
          Bootstrap
        </label>
        <p>Is the application already present in the Cloud or does it need to be bootstrapped?</p>
      </li>
      <li>
        <button id="run-taurify-init">Initialize project</button>
      </li>
    </ul>
  </form>
  <h2>Taurify: Organizations</h2>
  <ul id="orgs">    
    <li id="add-org">
      <input type="text" id="new-org-slug" placeholder="Org slug" required />
      <input type="password" id="new-org-key" placeholder="Org API key" required />
      <button id="add-org-button">Add org</button>
    </li>
  </ul>
  <script type="text/javascript" nonce="${scriptNonce}">
    ((vscode) => {
      document.getElementById('init-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        // TODO: validation
        const formData = new FormData(ev.target);
        const initData = Object.fromEntries(formData.entries());
        initData.platforms = formData.getAll('platforms');
        vscode.postMessage({ init: initData });
      });
      function addOrg(slug) {
        const option = document.createElement('option');
        option.value = slug;
        option.appendChild(new Text(slug));
        document.getElementById('org-slug').appendChild(option);
        const item = document.createElement('li');
        const name = document.createElement('span');
        name.appendChild(new Text(slug));
        item.appendChild(name);
        const remove = document.createElement('button');
        remove.appendChild(new Text('delete'));
        remove.addEventListener('click', () => {
          vscode.postMessage({ deleteOrg: slug });
          item.remove();
          option.remove();
        });
        item.appendChild(remove);
        document.getElementById('orgs').insertBefore(
          item,
          document.getElementById('add-org')
        );
        document.getElementById('no-orgs')?.remove();
      }
      (${JSON.stringify(Object.keys(orgs) || [])}).forEach(addOrg);
      document.getElementById('add-org-button').addEventListener('click', (ev) => {
        ev.preventDefault();
        const slugField = document.getElementById('new-org-slug');
        const keyField = document.getElementById('new-org-key');
        const slug = slugField.value;
        const key = keyField.value;
        if (slug && key) {
          vscode.postMessage({ addOrg: { slug, key } });
          addOrg(slug);
          slugField.value = keyField.value = '';
        } else {
          // TODO: error handling
          console.error('slug or key missing');
        }
      });
      document.querySelector('a[href="#new-org-slug"]').addEventListener('click', () => {
        document.getElementById('new-org-slug').focus();
      });
    })(acquireVsCodeApi());
  </script>
</body>
</html>`;
}

function getBar(progress: number) {
  const lastDigit = progress % 10;
  const firstDigit = (progress - lastDigit) / 10;
  return `${blocks[9].repeat(firstDigit)}${blocks[lastDigit]}`.trim();
}

function showProgress(progress: number) {
  if (progress !== 0) {
    statusBarItem!.text = `Taurification: ${getBar(progress)} ${progress}%`;
    statusBarItem!.accessibilityInformation = {
      role: "progressbar",
      label: "Taurification at ${progress} percent",
    };
    // TODO: use statusBarItem.tooltip = MarkdownString to provide additional information
  }
}

export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('taurify');

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    0
  );
  context.subscriptions.push(statusBarItem);
  statusBarItem.accessibilityInformation = { role: "button", label: "Taurify" };
  
  statusBarItem.text = "Taurify";
  statusBarItem.command = {
    title: "Taurify commands",
    command: "workbench.action.quickOpen",
    arguments: [">Taurify"],
  };

  const handleStatusBarVisibility = () => {
    if (config.inspect('showStatusBarApplet')?.globalValue !== false) {
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  };
  handleStatusBarVisibility();
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((ev) => { 
    if (ev.affectsConfiguration('taurify.showStatusBarApplet')) {
      handleStatusBarVisibility();
    }
  }));

  async function findConfig() {
    return await vscode.workspace.findFiles("taurify.json");
  }

  let project = { hasConfig: false };
  findConfig().then((config) => { project.hasConfig = config.length > 0; });

  async function getConfig(): Promise<{ cloudOrgSlug: string, [key: string]: unknown }> {
    try {
      const config = await findConfig();
      let dataFile = config.length === 1 ? config[0] : undefined;
      if (config.length === 0) {
        throw new Error('No config found');
      }
      if (config.length > 1) {
        const dataPath = await vscode.window.showQuickPick(config.map((uri) => uri.path));
        dataFile = config.find(({ path }) => path === dataPath);
      }
      if (!dataFile) {
        throw new Error('No config found');
      }
      const configFile = await vscode.workspace.fs.readFile(dataFile);
      if (!configFile) {
        throw new Error('Cannot read config');
      }
      const configData = JSON.parse(new TextDecoder().decode(configFile) || 'null');
      if (!configData) {
        throw new Error('Cannot decode config');
      }
      return configData;
    } catch(e: unknown) {
      throw new Error(`Unable to read the taurify config: ${e}`);
    }
  }

  async function getOrg(command: string) {
    try {
      return (await getConfig())?.cloudOrgSlug;
    } catch(e) {
      vscode.window.showErrorMessage(`${e}`, {}, 'vscode-taurify.init', command);
    }
  }

  async function getEnv(command: string) {
    const orgSlug = await getOrg(command);
    if (!orgSlug) { return; }
    try {
      const orgsKeys = JSON.parse(await context.secrets.get(ORGS_SECRET_STORAGE_KEY) || '{}');
      return { env: { CN_API_KEY: orgsKeys[orgSlug] } };
    } catch(e) {
      vscode.window.showErrorMessage(`Unable to get the API key for the configured org: ${e}`, {},
        'vscode-taurify.init', command);
    }
    return null;
  }

  function getRunner() {
    const runnerConfig = config.inspect('packageRunner');
    return runnerConfig?.globalValue || runnerConfig?.workspaceValue || runnerConfig?.defaultValue || 'npx';
  }

  async function runAbortable(
    command: string,
    options: ObjectEncodingOptions & ExecOptions = {},
    secrets: string[] = []
  ) {
    let logFile: FileHandle;
    if (config.inspect('enableLogs')?.globalValue) {
      let logFileName = config.inspect('logFile')?.globalValue;
      if (typeof logFileName === 'string') {
        console.log(`enabled logging to file ${logFileName}`);
        logFile = await open(logFileName, 'a');
      }
    }
    let secretFilter;
    const filterSecrets = (data: string) => {
      if (!secrets.length) {
        return data;
      }
      secretFilter ??= new RegExp(`\\b(${
        secrets.map(secret => secret.replace(/[\\\|+*?(){}[\]]/g, '\\$1')).join('|')
      })\\b`, 'g');
      return data.replace(secretFilter, '********');
    };
    const abort = new AbortController();
    const process = Object.assign(
      await exec(command, { ...options, signal: abort.signal }),
      { lastError: null as null | string }
    );
    process.on('worker', () => logFile?.appendFile(
      `[run ${new Date().toISOString()}] ${filterSecrets(command)}`,
      'utf-8'
    ));
    const { stdout, stderr } = process;
    stdout?.on("data", (chunk) => {
      const output = filterSecrets(chunk.toString());
      outputChannel.append(output);
      logFile?.appendFile(`[log ${new Date().toISOString()}] ${output}\n`, 'utf-8');
    });
    stderr?.on("data", (chunk) => {
      const output = filterSecrets(chunk.toString());
      outputChannel.append(output);
      process.lastError = output;
      logFile?.appendFile(`[err ${new Date().toISOString()}] ${output}\n`, 'utf-8');
    });
    process.on('exit', () => logFile?.close());
    return Object.assign(new vscode.Disposable(() => abort.abort()), { process });
  };

  const initCommand = vscode.commands.registerCommand(
    "vscode-taurify.init",
    async () => {
      let orgsKeys;
      try {
        orgsKeys = JSON.parse(await context.secrets.get(ORGS_SECRET_STORAGE_KEY) ?? '{}');
      } catch(e) {
        console.warn('taurify: orgs secret keys were corrupted');
        orgsKeys = {};
      }
      if (project.hasConfig) {
        vscode.window.showWarningMessage(
          'You already have a configured project. Make sure you do not override settings you still need.'
        );
      }
      const initView = vscode.window.createWebviewPanel(
        "taurify.initview",
        "Taurify",
        vscode.ViewColumn.One,
        { enableScripts: true }
      );
      initView.webview.html = createInitViewHTML(
        orgsKeys,
        vscode.workspace.workspaceFolders?.map(({name}) => name) ?? ['no folders found']
      );
      context.subscriptions.push(initView);

      initView.webview.onDidReceiveMessage(({ addOrg, deleteOrg, init }) => {
        if (addOrg) {
          const { slug, key } = addOrg;
          orgsKeys[slug] = key;
          context.secrets.store(ORGS_SECRET_STORAGE_KEY, JSON.stringify(orgsKeys));
        }
        if (deleteOrg) {
          delete orgsKeys[deleteOrg];
          context.secrets.store(ORGS_SECRET_STORAGE_KEY, JSON.stringify(orgsKeys));
        }
        if (init) {
          statusBarItem.text = 'Taurify: initializing...';
          const {
            productName, identifier, appSlug, orgSlug, projectPath, icon, platforms, 
            packageManager, password, runBeforeDev, runBeforeBuild, bootstrap
          } = init;

          runAbortable(
            `${getRunner()} taurify init --product-name "${productName
              }" --identifier "${identifier}" --org-slug "${orgSlug}" --app-slug "${appSlug
              }" --project-path "${projectPath}" --icon "${icon}" --platforms ${platforms.join(' ')
              } --package-manager ${packageManager} --password ${password} --runBeforeDev "${runBeforeDev
              }" --runBeforeBuild "${runBeforeBuild}"${bootstrap ? ' --bootstrap' : ''}`
          ).then((initCall) => { 
            context.subscriptions.push(initCall);
            initCall.process.on('exit', (code) => {
              if (statusBarItem.text === 'Taurify: initializing...') {
                statusBarItem.text = 'Taurify';
              }
              if ((code ?? 0) > 0) {
                vscode.window.showErrorMessage(`Taurify initialization failed: ${initCall.process.lastError}`);
              }
            });
          });
        }
      });
    }
  );
  context.subscriptions.push(initCommand);

  const devCommand = vscode.commands.registerCommand(
    "vscode-taurify.dev",
    async () => {
      if (!project.hasConfig) {
        vscode.window.showErrorMessage('No taurify.json found in workspace. Initialize your project first', 'vscode-taurify.init');
        return;
      }
      const options = await getEnv("vscode-taurify.build");
      const devCall = await runAbortable(`${getRunner()} taurify dev`, options ?? undefined);
      context.subscriptions.push(devCall);
    }
  );
  context.subscriptions.push(devCommand);

  const runCommand = vscode.commands.registerCommand(
    "vscode-taurify.run",
    async () => {
      if (!project.hasConfig) {
        vscode.window.showErrorMessage('No taurify.json found in workspace. Initialize your project first', 'vscode-taurify.init');
        return;
      }
      const options = await getEnv("vscode-taurify.build");
      const runCall = await runAbortable(`${getRunner()} taurify run`, options ?? undefined);
      context.subscriptions.push(runCall);
    }
  );
  context.subscriptions.push(runCommand);

  const buildCommand = vscode.commands.registerCommand(
    "vscode-taurify.build",
    async () => {
      if (!project.hasConfig) {
        vscode.window.showErrorMessage('No taurify.json found in workspace. Initialize your project first', 'vscode-taurify.init');
        return;
      }
      const options = await getEnv("vscode-taurify.build");
      if (!options) { return; }
      const buildCall = await runAbortable(`${getRunner()} taurify build`, options);
      context.subscriptions.push(buildCall);
    }
  );
  context.subscriptions.push(buildCommand);

  const updateCommand = vscode.commands.registerCommand(
    "vscode-taurify.update",
    async () => {
      if (!project.hasConfig) {
        vscode.window.showErrorMessage('No taurify.json found in workspace. Initialize your project first', 'vscode-taurify.init');
        return;
      }
      const options = await getEnv("vscode-taurify.update");
      if (!options) { return; }
      const updateCall = await runAbortable(`${getRunner()} taurify update`, options);
      context.subscriptions.push(updateCall);
    }
  );
  context.subscriptions.push(updateCommand);
}

export function deactivate() {}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}