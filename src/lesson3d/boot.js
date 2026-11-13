// Entry: the studio page (#/new) or a book (built-in or generated). Changing the hash reloads.
import { route } from './route.js';

addEventListener('hashchange', () => location.reload());
if (route().page === 'studio') import('./studio/studio.js').then((m) => m.mountStudio());
else import('./main.js');
