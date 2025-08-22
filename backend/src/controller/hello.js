module.exports = class extends think.Controller {
  async indexAction() {
    this.body = { message: 'Hello from ThinkJS' }
  }
}