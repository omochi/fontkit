import { registerFormat, openSync, open, create, defaultLanguage, setDefaultLanguage } from './base';
import TTFFont from './TTFFont';
import WOFFFont from './WOFFFont';
import TrueTypeCollection from './TrueTypeCollection';
import DFont from './DFont';

// Register font formats
registerFormat(TTFFont);
registerFormat(WOFFFont);
registerFormat(TrueTypeCollection);
registerFormat(DFont);

export * from './base';

// Legacy default export for backward compatibility.
export default {
  registerFormat,
  openSync,
  open,
  create,
  defaultLanguage,
  setDefaultLanguage
};
