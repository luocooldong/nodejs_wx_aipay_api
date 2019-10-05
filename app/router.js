'use strict';

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { router, controller } = app;
  const islogin = app.middleware.islogin();
  router.get('/addons/pay/api/setting', controller.client.index); // 效验客户端
  router.get('/addons/pay/api/notify', controller.client.pay); // 接收客户端推送信息
  router.resources('login', '/api/login', controller.login); // 登录
  router.post('/api/updata', islogin, controller.updata.index); // 上传二维码
  router.resources('qrcode', '/api/qrcode', islogin, controller.qrcode); // 后台二维码
  router.resources('order', '/api/order', islogin, controller.order); // 后台权限操作订单
  router.post('/api/order', controller.order.create_order); // 新增订单接口
  router.post('/api/queryPayStatus', controller.order.query_pay_status); //查询单条记录是否成功

  router.post('/api/queryUserPayStatusList', controller.order.query_user_pay_status_list); //根据用户id查询该用户所有产生的订单列表

  // 处理订单支付状态
  router.post('/api/orderPayStatus', controller.order.orderPayStatus); // 处理订单支付状态
};
