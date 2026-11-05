const R = require('../../utils/rules');

Component({
  properties: { show: { type: Boolean, value: false } },
  data: { rings: R.RING },
  methods: {
    close() { this.triggerEvent('close'); },
    noop() {},
    call112() { wx.makePhoneCall({ phoneNumber: '112', fail() {} }); }
  }
});
