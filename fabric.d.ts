// fabric v5 does not ship TypeScript declarations.
// This minimal declaration allows dynamic imports without type errors.
declare module 'fabric' {
  const fabric: any;
  export { fabric };
  export const Canvas: any;
  export const Image: any;
  export const Rect: any;
  export const IText: any;
  export const Textbox: any;
  export const Object: any;
  export const Group: any;
}
