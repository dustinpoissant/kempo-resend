import install from './install.js';

/* An update repeats the install, which only ever adds a key that is not saved yet. */
export default async () => {
  await install();
};
