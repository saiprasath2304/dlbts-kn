import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import adapterNode from '@sveltejs/adapter-node';
import adapterVercel from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

// Vercel sets VERCEL=1 during its builds; everywhere else we build a Node server.
const adapter = process.env.VERCEL ? adapterVercel({ runtime: 'nodejs22.x' }) : adapterNode();

export default defineConfig(({ mode }) => {
	// Public URL of a Node deployment, e.g. https://judging.example.org (build time).
	// Needed so form posts pass SvelteKit's CSRF origin check. Not needed on Vercel,
	// or behind a proxy that sends X-Forwarded-Proto/Host (see README).
	const origin = loadEnv(mode, process.cwd(), '').ORIGIN || undefined;
	return {
		plugins: [
			tailwindcss(),
			sveltekit({
				compilerOptions: {
					// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true
				},
				adapter,
				paths: { origin },
				csp: {
					mode: 'auto',
					directives: {
						'default-src': ['self'],
						'script-src': ['self'],
						'style-src': ['self', 'unsafe-inline'],
						'img-src': ['self', 'data:', 'blob:'],
						'font-src': ['self'],
						'connect-src': [
							'self',
							'https:',
							'wss:',
							'http://127.0.0.1:54321',
							'ws://127.0.0.1:54321'
						],
						'frame-src': ['self', 'blob:'],
						'object-src': ['none'],
						'base-uri': ['self'],
						'form-action': ['self'],
						'frame-ancestors': ['self']
					}
				}
			})
		],
		test: {
			expect: { requireAssertions: true },
			projects: [
				{
					extends: './vite.config.ts',
					test: {
						name: 'unit',
						environment: 'node',
						include: ['src/**/*.{test,spec}.{js,ts}'],
						exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
					}
				},
				{
					extends: './vite.config.ts',
					test: {
						name: 'integration',
						environment: 'node',
						include: ['tests/integration/**/*.test.ts'],
						testTimeout: 30_000,
						hookTimeout: 60_000,
						fileParallelism: false
					}
				}
			]
		}
	};
});
