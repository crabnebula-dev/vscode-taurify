import * as vscode from 'vscode';

// debugging; TODO: remove
(globalThis as any).vscode = vscode;

const blocks = " ▏▎▍▌▋▊▉▉▉";

let statusBarItem: vscode.StatusBarItem;

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
			label: "Taurification at ${progress} percent"
		};
		// TODO: use statusBarItem.tooltip = MarkdownString to provide additional information
	}
}

/*
Configuration: 

organization API key (key-value based on org slug to handle multiple orgs)
android/ios app signing keys based on org slug
path to cn / cn.exe
*/

function noConfigFound() {
	statusBarItem!.text = 'Taurify';
	statusBarItem!.command = "vscode-taurify.init";
	statusBarItem!.tooltip = "## Initialize this project with Taurify\n\nIf you click this status applet, your web app will be automatically converted to a tauri app."
}

export function activate(context: vscode.ExtensionContext) {
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
	context.subscriptions.push(statusBarItem);
	statusBarItem.accessibilityInformation = { role: "button", label: "Taurify" };	
	statusBarItem.show();
	statusBarItem.text = 'Taurify';
	statusBarItem.command = 'vscode-taurify.menu';
	
	// check for taurify.json in project root
	vscode.workspace.findFiles('taurify.json').then((found) => {
		if (found.length) {
			statusBarItem!.text = 'found taurify.json';
		} else {
			noConfigFound();
		}
	}, (error) => {
		console.error('taurify', error);
		noConfigFound();
	});	

	const initCommand = vscode.commands.registerCommand('vscode-taurify.init', async () => {
		const settings = vscode.workspace.getConfiguration('taurify');
		const orgSlugs = Object.keys(settings.orgsKeys).filter(key => key !== 'myOrgSlug');
		let orgSlug: string | undefined = orgSlugs[0];
		if (orgSlugs.length === 0) {			
			vscode.commands.executeCommand('workbench.action.openSettingsJson');
			return;
		} else if (orgSlugs.length > 1) {
			orgSlug = (await vscode.window.showQuickPick(orgSlugs, { title: "Select your organization" }))?.[0];
		}
		console.log(orgSlugs, orgSlug);
		// TODO: init with orgslug
		/*
		const initTask = new vscode.Task({
			definition: `taurify init --orgslug `
			execution: vscode.ShellExecution,
			isBackground: false,
			name: "taurify-init"
		});
		*/
	});
	context.subscriptions.push(initCommand);

	const devCommand = vscode.commands.registerCommand('vscode-taurify.dev', () => {
		// TODO: finalize
		const devTask = new vscode.Task({
			label: "Run in development mode",
			type: "shell",
			command: `taurify dev`
		}, "workspace", "taurify-dev");
	});
	context.subscriptions.push(devCommand);

	const runCommand = vscode.commands.registerCommand('vscode-taurify.run', () => {

	});
	context.subscriptions.push(runCommand);

	const buildCommand = vscode.commands.registerCommand('vscode-taurify.build', () => {

	});
	context.subscriptions.push(buildCommand);

	const updateCommand = vscode.commands.registerCommand('vscode-taurify.update', () => {

	});
	context.subscriptions.push(updateCommand);

	/*

	const disposable = vscode.commands.registerCommand('vscode-taurify.taurify', () => {
		// if not present, show a convenient GUI around `npx taurify init` to create taurify.json
		// load settings: organization API key
		// if ios or android builds are selected, check for signing keys
		// if no signing keys are present, open the settings and the pages where you can apply for them
		// if organization API key is not present, open the settings and at the same time the page where you would get the API key if you are already logged in
		// actually start taurify and send actual update information
		showProgress(Math.floor(Math.random() * 101));
	});

	context.subscriptions.push(disposable);
	*/
}

export function deactivate() {
	// TOOO: stop taurification process if possible
}
