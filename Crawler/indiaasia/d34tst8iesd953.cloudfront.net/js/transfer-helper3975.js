/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

$(document).ready(function () {
  // This is a hack to keep the error message tracking logic happy. This should be 
  // refactored later on once we polish up this page.
  ivisa['app_config'] = {};
  ivisa.app_config.order_type = 'transfer';

  ivisa.init_input_widgets($('.transfer-order-form'));
});

var transfer_helper = new function () {
  this.submit_form_data = function () {
    var wrapper = $(".transfer-order-form");
    var missing_fields = get_missing_fields(wrapper, true);
    if (missing_fields.length === 0) {
      ivisa.show_error_message('');
      var form_fields = get_form_fields(wrapper);
      open_stripe_form(form_fields);
    } else {
      return ivisa.show_error_message(ivisa.missing_required_fields_msg, missing_fields);
    }
  }
};

function open_stripe_form(form_data) {
  var handler = StripeCheckout.configure({
    key: window.stripe_publishable,
    image: 'https://stripe.com/img/documentation/checkout/marketplace.png',
    locale: 'auto',
    token: function (token) {
      // You can access the token ID with `token.id`.
      // Get the token ID to your server-side code for use.
      submit_stripe_token_with_form_data(token, form_data);
    }
  });

  var amountString = form_data.car_type.split('$')[1];
  var amountCents = parseFloat(amountString) * 100;
  handler.open({
    name: 'ivisa.com',
    description: '2 widgets',
    zipCode: true,
    amount: amountCents,
  });

  // Close Checkout on page navigation:
  window.addEventListener('popstate', function () {
    handler.close();
  });
}

function get_form_fields($wrapper) {
  var data = {};
  $wrapper.find('input, select, textarea').each(function () {
    var field_name = $(this).attr('data-ivisa-name');
    var val = ivisa.get_input_value(this);
    data[field_name] = val;
  })
  
  // If we don't have a destination country at this point, add the one
  // set on the window.
  if (data.destination_country === undefined) {
    data.destination_country = window.destination_country;
  }
  return data;
}

function get_missing_fields($wrapper, add_missing_class) {
  var missing_required_fields = [];
  $wrapper.find('input, select, textarea').each(function () {
    var field_name = $(this).attr('data-ivisa-name');
    var val = ivisa.get_input_value(this);

    if ($(this).attr('data-ivisa-required') == "true" && (val == null || val.length === 0) && ivisa.is_field_visible($(this))) {
      missing_required_fields.push(field_name)
      if (add_missing_class !== false)
        $(this).closest('.ivisa-input-wrapper').addClass('ivisa-missing-required');
    } else {
      if (add_missing_class !== false)
        $(this).closest('.ivisa-input-wrapper').removeClass('ivisa-missing-required')
    }
  })

  return missing_required_fields;
}

function submit_stripe_token_with_form_data(token, form_data) {
  // Make an ajax request here to the server to 
  var data = {stripe_token: token, form_data: form_data};
  var url = '/transfers/submit_form';
  $.post(url, data)
          .done(function (responseData, status, jqXHR) {
            if (responseData.success === true) {
              window.location.replace('/transfers/order_complete');
            } else {
              ivisa.show_error_message(responseData.message);
            }
          });
}