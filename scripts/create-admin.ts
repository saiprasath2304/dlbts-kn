/**
 * Bootstrap an administrator account. There is deliberately no web endpoint
 * for this: only someone holding the service-role key (an operator) can run it.
 *
 *   npm run create-admin -- --username admin --name "Event Admin"
 *
 * The password is read from a hidden prompt (or ADMIN_PASSWORD for automation)
 * so it never appears in shell history or process listings.
 */
import { arg, createAccount, promptHidden, serviceClient } from './lib.ts';
import { isValidUsername, normalizeUsername, validatePassword } from '../src/lib/usernames.ts';

const username = normalizeUsername(arg('username') ?? 'admin');
const name = arg('name') ?? 'Administrator';

if (!isValidUsername(username)) {
	console.error('Invalid username: use 3-50 lowercase letters, digits, dot, dash or underscore.');
	process.exit(1);
}

const supabase = serviceClient();
const { data: existing } = await supabase
	.from('profiles')
	.select('id')
	.eq('username', username)
	.maybeSingle();
if (existing) {
	console.error(`An account named "${username}" already exists. Choose another username.`);
	process.exit(1);
}

let password = process.env.ADMIN_PASSWORD ?? '';
if (!password) {
	password = await promptHidden(`Password for ${username} (min 8 characters, input hidden): `);
	const again = await promptHidden('Repeat password: ');
	if (password !== again) {
		console.error('Passwords do not match.');
		process.exit(1);
	}
}
if (validatePassword(password) || password.length < 8) {
	console.error('Admin passwords must be 8-72 characters.');
	process.exit(1);
}

const id = await createAccount(supabase, { username, password, displayName: name, role: 'admin' });
console.log(`Admin "${username}" created (id ${id}). Sign in at /login.`);
