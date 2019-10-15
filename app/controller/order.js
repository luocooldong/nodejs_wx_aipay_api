'use strict';

const Controller = require('egg').Controller;
const md5 = require('md5');

class OrderController extends Controller {

  // 根据用户id查询该用户的所有产生的订单
  async query_user_pay_status_list() {
    const { ctx, app } = this;
    const { user_id } = ctx.request.body;
    console.log(user_id, 'hello world')
    console.log('okokok月亮太阳')
    // 根据此订单id去查询这条订单是否支付成功
    try {
      const userOrderItem_data = await ctx.model.Orders.findAll({ where: { user_id: user_id, pay_status: '已支付' } });

      console.log(userOrderItem_data, 'hank hooked')
      if(!userOrderItem_data) {
        throw 'user_id不存在';
      }
      ctx.body = userOrderItem_data
    }catch (e){
      ctx.body = { code: -1, data: '', msg: e };
    }
  }



  // 查询单个交易是否成功
  async query_pay_status() {
    const { ctx, app } = this;
    const { order_id } = ctx.request.body;
    console.log(order_id, 'hello world')
    console.log('okokok月亮太阳')
    // 根据此订单id去查询这条订单是否支付成功
    try {
      const orderItem_data = await ctx.model.Orders.findOne({ where: { order_id: order_id } });
      console.log(orderItem_data, 'hank hooked')
      if(!orderItem_data) {
        throw 'order_id不存在';
      }
      ctx.body = orderItem_data
    }catch (e){
      ctx.body = { code: -1, data: '', msg: e };
    }
  }

  // 后台查询所有订单
  async index() {
    const { ctx, app } = this;
    const { Op } = app.Sequelize;
    const { page, order_type, pay_status, order_id, date_start, date_end } = ctx.query;
    try {
      const where = {};
      if (order_type !== '') {
        where.order_type = order_type;
      }
      if (pay_status !== '') {
        where.pay_status = pay_status;
      }
      if (order_id !== '') {
        where.order_id = order_id;
      }
      if (date_start !== '') {
        where.created_at = {
          [Op.gt]: new Date(Math.abs(date_start)),
        };
      }
      if (date_end !== '') {
        where.created_at[Op.lt] = new Date(Math.abs(date_end));
      }
      const result = await ctx.model.Orders.findAndCountAll({
        where,
        offset: (page - 1) * 10,
        limit: 10,
        order: [
          ['id', 'DESC'],
        ],
      });
      // 已支付订单金额
      const numPriceWere = where;
      numPriceWere.pay_status = '已支付';
      const numPrice = await ctx.model.Orders.sum('qr_price', {
        where: numPriceWere,
      });
      // 所有订单数
      const numOrder = await ctx.model.Orders.count({
        where,
      });
      result.numPrice = numPrice;
      result.numOrder = numOrder;

      console.log(result.rows, 'fuck the order')
      result.rows.map((item) => {
        console.log(item.dataValues.created_at, '❤️❤️')
        // item.dataValues.created_at = 'ok'
        return item
      })


      ctx.body = result;
    } catch (e) {
      ctx.body = { code: -1, data: '', msg: e };
    }
  }

  /**
   *
   * @api {post} /api/order 创建支付订单
   * @apiName 创建支付订单
   * @apiGroup order
   * @apiVersion  1.0.1
   * @apiDescription 请求类型 Content-Type: application/json;charset=UTF-8，请勿务在前端请求，会泄露secretkey
   *
   * @apiParam  {String} order_id 外部订单编号
   * @apiParam  {String} order_type 支付方式 wechat（微信） alipay（支付宝） 默认 wechat
   * @apiParam  {String} order_price 订单金额 保留两位小数
   * @apiParam  {String} order_name 订单名称/商品名称
   * @apiParam  {String} sign 签名->加密方法 md5(md5(order_id + order_price) + secretkey) // 这里的 + 是字符串拼接
   * @apiParam  {String} redirect_url 支付成功服务器回调地址包含 http(s)://，当订单已支付会向这个url地址推送”一次“Get请求！包含三个参数order_id 、qr_price（实际支付金额） 、extension  和 sign加密方式为 md5(md5(order_id) + secretkey)
   * @apiParam  {String} extension 创建订单时后端传入的扩展信息，支付成功后原样返回，中文需要url编码后传入
   *
   */
  async create_order() {
    const { ctx, config: { secretkey, payMax, domain, alipayUserId } } = this;
    const { order_id, order_type, order_price, sign, redirect_url, video_id, share_code, effective_time } = ctx.request.body;
    try {
      if (!order_id) {
        throw 'order_id不为空';
      } else if (!order_type) {
        throw 'order_type不为空!';
      } else if (!order_price) {
        throw 'order_price不为空!';
      } else if (parseFloat(order_price) <= 0) {
        throw 'order_price不小于等于0!';
      } else if (!redirect_url) {
        throw 'redirect_url不为空!';
      }
      if (sign !== md5(md5(order_id.toString() + order_price.toString()) + secretkey.toString())) {
        throw '签名错误';
      }
      // 处理过期订单
      await ctx.service.order.update();
      // 查询未过期/支付的相同金额的订单
      const orderPriceStatus = await ctx.model.Orders.findAll({ where: { order_type, order_price, pay_status: '未支付' } });
      if (order_type === 'wechat') {
        let tempPrice = order_price;
        // if (orderPriceStatus.length === 0) {
        if (false) {
          // 此金额可被使用 查出金额对应的 支付qr_url 生成订单
          const qr_data = await ctx.model.Qrcodes.findOne({ where: { qr_type: order_type, qr_price: order_price } });
          if (!qr_data) {
            throw '订单金额的二维码不存在aa'; // 订单金额的二维码不存在
          }
          ctx.body = await ctx.service.order.createOrder(qr_data.get('qr_url'), qr_data.get('qr_price'));
        } else {
          // 此金额已经被使用了，查询其他二维码
          let newPrice = [];
          // 根据设置的随机立减查询二维码
          if(Number(order_price) === 1) {
            for (let i = 0; i < payMax.wx; i++) {
              newPrice.push((tempPrice -= 0.01).toFixed(2));
            }
          }else{
            for (let i = 0; i < (Number(order_price) - 5) * payMax.wx; i++) {
              newPrice.push((tempPrice -= 0.01).toFixed(2));
            }
          }

          // 获取有效期内所有的未支付订单
          const QrCodeResult = await ctx.service.order.find_more_price(newPrice, order_type);
          if (QrCodeResult.length !== 0) {
            QrCodeResult.forEach(item => {
              newPrice.push(item.dataValues.qr_price);
            });
          }
          const filterNewPrice = arr => arr.filter(i => arr.indexOf(i) === arr.lastIndexOf(i)); // 找出可以使用的金额
          newPrice = filterNewPrice(newPrice);

          const canUseQrcode = await ctx.model.Qrcodes.findAll();

          const filterArr = canUseQrcode.map((item) => item.dataValues.qr_price)

          console.log('🌛', filterArr)

          newPrice = newPrice.filter((price) => filterArr.indexOf(price) !== -1)
          // newPrice = ['9.99']
          console.log('❤️', newPrice)

          // 根据可以使用的金额查询收款二维码
          const alipay_url = await ctx.service.qrdecode.find_pay_url(newPrice, order_type);
          if (alipay_url.length === 0) { // 没有可用收款二维码
            throw '系统火爆，请过1-3分钟后下单!';
          }

          alipay_url.sort((firstItem, secondItem) => Number(secondItem.dataValues.qr_price) -  Number(firstItem.dataValues.qr_price) )

          let finalAlipayUrl = alipay_url.slice(0, 20)

          const index = Math.floor((Math.random() * (finalAlipayUrl.length-1)));
          // 现在不用随机数了，直接取数据中的第一个
          ctx.body = await ctx.service.order.createOrder(finalAlipayUrl[index].dataValues.qr_url, finalAlipayUrl[index].dataValues.qr_price);
        }
      } else if (order_type === 'alipay') {
        const alipays = 'alipays://platformapi/startapp?appId=20000691&url='; // 2019年04月07日 原appid 20000067 替换成 20000691
        const url = domain + '/alipay.html?u=' + alipayUserId + '&a=';
        let tempPrice = order_price;
        if (orderPriceStatus.length === 0) {
          // 此金额可被使用
          ctx.body = await ctx.service.order.createOrder(alipays + encodeURIComponent(url + tempPrice), tempPrice);
        } else {
          // 此金额已经被使用了，查询其他二维码
          let newPrice = [];
          // 根据设置的随机立减查询二维码
          for (let i = 0; i < payMax.alipay; i++) {
            newPrice.push((tempPrice -= 0.01).toFixed(2));
          }
          // 获取有效期内所有的未支付订单
          const QrCodeResult = await ctx.service.order.find_more_price(newPrice, order_type);
          if (QrCodeResult.length !== 0) {
            QrCodeResult.forEach(item => {
              newPrice.push(item.dataValues.qr_price);
            });
          }
          const filterNewPrice = arr => arr.filter(i => arr.indexOf(i) === arr.lastIndexOf(i)); // 找出可以使用的金额
          newPrice = filterNewPrice(newPrice);
          const index = Math.floor((Math.random() * newPrice.length));
          if (newPrice.length === 0) { // 支付宝立减金额达到上限
            throw '系统火爆，请过1-3分钟后下单!';
          }
          ctx.body = await ctx.service.order.createOrder(alipays + encodeURIComponent(url + newPrice[index]), newPrice[index]);
        }
      }
    } catch (e) {
      ctx.body = { code: -1, data: '', msg: e };
    }
  }
  // 补单
  async update() {
    const { ctx, app, config: { orderValidity, secretkey } } = this;
    const { id } = ctx.params;
    const { Op } = app.Sequelize;

    // 查询订单信息
    const orderData = await ctx.model.Orders.findOne({
      where: {
        id,
      },
    });

    await ctx.model.Orders.update({
      pay_status: '已支付',
    }, {
      where: {
        id,
      },
    });
    try {
      // 通知服务器
      const { order_id, qr_price, extension, redirect_url } = orderData;
      // sign md5(md5(order_id) + secretkey)
      const sign = md5(md5(order_id) + secretkey);
      const url = redirect_url + '?order_id=' + order_id + '&qr_price=' + qr_price + '&extension=' + extension + '&sign=' + sign;
      await ctx.service.order.get_redirect_url(url);
    } catch (e) {
      ctx.body = { code: -1, data: '', msg: '补单失败,订单状态异常!' };
      return false;
    }
    ctx.body = { code: 0, data: '', msg: '补单成功!' };
  }

  // 查询订单支付状态
  async orderPayStatus() {
    const { ctx, config: { secretkey, payMax, domain, alipayUserId } } = this;
    const { order_id } = ctx.request.body;
    console.log('查询订单支付状态, controller层', order_id)
    const result = await ctx.service.order.order_Pay_Status(order_id);
  }
}

module.exports = OrderController;
