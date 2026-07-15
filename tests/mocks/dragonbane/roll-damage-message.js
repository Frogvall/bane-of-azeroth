export default class DoDRollDamageMessageData {
  static fromContext(context) {
    return {
      context,
      toMessage: async () => undefined,
    };
  }
}
