import * as assert from 'assert';
import * as vscode from 'vscode';
import { escapeAttr, escapeHtml } from '../extension';

suite('vscode-taurify Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	const controller = vscode.tests.createTestController(
		'vscode-taurify-test', 
		'Testing vscode-taurify'
	);

	test('XSS prevention: attribute escaping', () => {
		assert.equal(
			escapeAttr('" onmouseover="alert(1)'),
			'\\" onmouseover=\\"alert(1)',
			'HTML attribute hoverjackign worked'
		);
	});

	test('XSS prevention: html escaping', () => {
		assert.equal(
			escapeHtml('<span onmouseover="alert(1)">&nbsp;</span>'),
			'&lt;span onmouseover="alert(1)">&nbsp;&lt;/span>',
			'HTML hoverjacking worked'
		);
	});
});
