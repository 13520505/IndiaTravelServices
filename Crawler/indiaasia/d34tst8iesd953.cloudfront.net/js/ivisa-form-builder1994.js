
var ivisa = new function(){
  this.version = "2016-05-25";
  
  this.debug = false;
  
  this.api_domain = 'https://' + document.domain;
  
  this.ajax_form_submission_url = '';   // used if you want a single/unified endpoint
  this.form_submission_url_append = ''; // useful for utm_source or other GET params
  
  this.file_upload_endpoint = null;  // uses default from API
  this.visa_calculator_endpoint = '/visa' + '/' + 'estimate_visa_price';
  
  this.missing_required_fields_msg = "Please fill out all required fields (outlined in red above)";
  
  this.require_user_payment = true;
  
  this.application_started = false;
  
  // DEBUG: Console log
  this.log = function(data){
    if(ivisa.debug == true && data !== null && data !== '')
      console.log(data)
  }
  
  this.__ = function(word){
    // Translations
    if(typeof window.word_translations != 'undefined' && typeof window.word_translations[word.toLowerCase()] == 'string')
      return window.word_translations[word.toLowerCase()];
    return word;
  }
  
  this.order_validation_successful = function(resp){
    // Order has passed validation -- Let's collect payment
    ivisa.paypal_charge_token = typeof resp.paypal_charge_token == 'string'? resp.paypal_charge_token : null;
    if(ivisa.paypal_charge_token == null)
      $('#ivisa-paypal-button').hide();
    else
      $('#ivisa-paypal-button').show();
    
    $('.ivisa-before-review').hide();
    $('.ivisa-review-and-pay').show();
    
    $('.ivisa-instr-step1').hide();
    $('.ivisa-instr-step2').show();
    
    ivisa.log(resp)
    
    ivisa.scroll_to_top();
    ivisa.set_progress_bar(2);
    
    ivisa.gtm_record_checkout_page();
    
    if(resp.data.traveler_list[0].first_name !== undefined)
      $('[data-ivisa-secure="name"]').val(resp.data.traveler_list[0].first_name + ' ' + resp.data.traveler_list[0].last_name);
    else
      $('[data-ivisa-secure="name"]').val(resp.data.first_name + ' ' + resp.data.last_name);
    
    ivisa.build_visa_confirmation_table(resp.data, []);
  }
  
  this.scroll_to_top = function(){
    $("html, body").animate({ scrollTop: 0 }, "fast"); // Scroll to top of page
  }
  
  this.order_submission_successful = function(info){
    // This function can be overriden
    $('.ivisa-order-form').css('transition','1s opacity').css('opacity',0)
    window.location.replace(ivisa.api_domain + '/account/order/' + info.order_id);
  }
  
  this.init = function(config){
    // Debugging support
    if(!window.console) console = {};
    console.log = console.log || function(){};
    
    ivisa._config = config;
    if(typeof window.ivisa_api_output['app_config'] == 'undefined')
      alert('Missing window.ivisa_api_output');
    
    ivisa.app_config = window.ivisa_api_output['app_config'];
    
    ivisa.currency = ivisa.get_input_value($('[data-ivisa-name="currency"]'))
    if(ivisa.currency == null || ivisa.currency.length != 3){
      if(typeof ivisa._config['currency'] != 'undefined')
        ivisa.currency = ivisa._config['currency'];
      else
        ivisa.currency = 'USD';
    }
    
    if(ivisa.file_upload_endpoint == null)
      ivisa.file_upload_endpoint = ivisa.app_config.file_upload_endpoint;
    
    var updating_existing_order = typeof ivisa.app_config.order_id === 'undefined'? false : true;
    
    ivisa.mop = 'cc'; // Default Method of Payment
    ivisa.init_embassy_registration();
    
    ivisa.init_watch_variables();
    
    ivisa.init_input_widgets($('#ivisa-global-fields'));
    ivisa.init_input_widgets($('#ivisa-subtotal-section'));
    
    if(updating_existing_order){
      var trav_count = 0;
      $('.ivisa-applicant-fields').each(function(){ 
        ivisa.prefill_applicant_fields(trav_count, window.ivisa_api_output.per_applicant_fields_prefill[trav_count], true)
        ivisa.init_input_widgets($(this)); 
        trav_count++;
      })
      ivisa.multipart_update_step_widget();
    }
    else {
      if(typeof window.ivisa_api_output['per_applicant_fields_prefill'] != 'undefined'){
        $.each(window.ivisa_api_output.per_applicant_fields_prefill, function(i, trav){
          ivisa.add_applicant();
          ivisa.prefill_applicant_fields(i, trav)
        })
      }
      else {
        ivisa.add_applicant();
      }
      
      if(typeof window.ivisa_api_output['global_fields_prefill'] != 'undefined'){
        ivisa.prefill_fields( $('#ivisa-global-fields'), window.ivisa_api_output['global_fields_prefill'])
      }
    }
    
    ivisa.init_uploader()
    
    ivisa.update_delivery_options();
    ivisa.init_paypal();
    
    ivisa.init_progress_bar();
    
    $('.ivisa-special-instructions').html(ivisa.app_config.special_instructions)
    
    if(typeof ivisa.app_config.order_details_footnote != "undefined")
      $('#ivisa-order-details-footnote').html('<span class="label label-info">Note</span> ' + ivisa.app_config.order_details_footnote);
    
    if(!updating_existing_order){
      if(ivisa.app_config.order_type == 'visa')
        ivisa.gtm_record_product_view({ 'name': 'visa', 'category': 'visa', 'brand': ivisa.destination_country() });
      else if(ivisa.app_config.order_type == 'passport_photo')
        ivisa.gtm_record_product_view({ 'name': 'passport_photo', 'category': 'passport_photo' });
    }
    
    if(ivisa.app_config.order_type == 'passport_photo'){
      $('.ivisa-total-price-wrapper').show();
    }

    $(document).click(function(){  $('[data-toggle="tooltip"]').popover("hide"); });

    ivisa.hide_unnecessary_divider_lines();
    ivisa.update_price();
  }
  
  this.destination_country = function(){
    return ivisa.app_config.country_codes[ivisa.destination_country_code()].toLowerCase().replace(' ','_')
  }
  
  this.init_watch_variables = function(){
    // Note: To watch applicant variables, use ivisa.init_input_widgets()
    
    // WATCH
    $('[data-ivisa-name="arrival_date"]').change(function(){
      ivisa.update_visa_validity_info();
      ivisa.update_delivery_options();
      ivisa.update_price();
      
     // Application started
      if(ivisa.application_started == false){
        ivisa.application_started = true;
        window.onbeforeunload = function (e) { return "Leave this page and discard changes?"; };
      }
    })
    
    $('[data-ivisa-price]').change(function(){
      ivisa.update_price();
    });
    
    $('[data-ivisa-affects-price]').change(function(){
      ivisa.update_price();
    });
    
    $('[data-ivisa-name="currency"]').change(function(){
      ivisa.currency = ivisa.get_input_value(this)
      ivisa.update_price();
    }).change();
    
    $('input[name="ivisa_delivery_option"]').click(function(){
      var product = { 'name': 'rush_fee', 'category': 'visa', 'brand': ivisa.destination_country() , 'quantity':1 };
      var super_product = $.extend({}, product);
      super_product['name'] = 'super_rush_fee';
      
      var val = $(this).val();
      if(val == "rush"){
        ivisa.gtm_remove_from_cart_by_product_info(super_product)
        ivisa.gtm_add_to_cart_if(product, { 'quantity==' : 0 })
      } else if(val == "super_rush"){
        ivisa.gtm_remove_from_cart_by_product_info(product)
        ivisa.gtm_add_to_cart_if(super_product, { 'quantity==' : 0 })
      }
      else{ 
        ivisa.gtm_remove_from_cart_by_product_info(product)
        ivisa.gtm_remove_from_cart_by_product_info(super_product)
      }
    });
  }
  
  this.update_price_currencies = function(){
    $('[data-ivisa-convert-currency]').each(function(){
      var price_usd = $(this).attr('data-ivisa-convert-currency')
      $(this).html(ivisa.format_currency(ivisa.convert_currency(price_usd, ivisa.currency), ivisa.currecy))
    })
  }
  
  this.init_input_widgets = function($parent){
    ivisa.init_show_if($parent);
      
    $parent.find('[data-ivisa-prevent-submission-if]').each(function(){ ivisa.init_prevent_submission_if($(this)); })
    $parent.find('.ivisa-fieldset-wrapper').each(function(){ ivisa.init_fieldset_repeat($(this)); })

    
    $parent.find('.ivisa-input-file-upload, .ivisa-input-image-upload').bind('change', function(){ ivisa.upload_file_selected(this) })
    
    $parent.find('.ivisa-input-datepicker').each(function(){
      var datepicker_config = { "dateFormat":"yy-mm-dd", "changeMonth": true, "changeYear": true, "yearRange": "-110:+110" };
      if($(this).data('ivisa-min-date') != null)
        datepicker_config.minDate = $(this).data('ivisa-min-date');
      if($(this).data('ivisa-max-date') != null)
        datepicker_config.maxDate = $(this).data('ivisa-max-date');
      
      datepicker_config.beforeShow = function(input, inst){
        $('#ui-datepicker-div').addClass('notranslate'); // Google Translate hack
      };
      
      var ivisa_name = $(this).attr('data-ivisa-name');
      if(ivisa_name == 'arrival_date' || ivisa_name == 'departure_date')
        $(this).datepicker( datepicker_config );
      else {
        $(this).click(function(){
          ivisa.show_ivisa_datepicker(this);
        });
        $(this).bind('focus', function(){
          // Did this input gain focus as a result of a user-action (tab key)?
          if(ivisa.dp_modal_just_exited !== undefined && ivisa.dp_modal_just_exited === true){
            ivisa.dp_modal_just_exited = false;
            return;
          }
          else{
            ivisa.show_ivisa_datepicker(this);
          }
        })
      }
    })
    
    $parent.find('[data-toggle="tooltip"]').popover().click(function(e){ e.stopPropagation(); });

    
    // WATCH
    $parent.find('[data-ivisa-name="nationality_country"]').change(function(){
      if(ivisa.get_traveler_nationalities().length >0)
        $('.ivisa-total-price-wrapper').show();
      
      ivisa.update_delivery_options();
      ivisa.update_embassy_registration_options();
      ivisa.update_price();
      ivisa.gtm_traveler_nationalities_changed()
    })
    
    // WATCH
    $parent.find('[data-ivisa-price]').change(function(){
      ivisa.update_price();
    });
    
    // WATCH
    $parent.find('[data-ivisa-affects-price]').change(function(){
      ivisa.update_price();
    });
    
    // WATCH
    $parent.find('[data-ivisa-name="dob"]').change(function(){
      ivisa.update_price();
    })
    
    // WATCH
    $parent.find('[data-ivisa-name="passport_expiration_date"]').change(function(){
      ivisa.update_visa_validity_info();
    })

    // WATCH
    $parent.find('[data-ivisa-name="visa_type"]').change(function(){
      ivisa.update_visa_validity_info();
      ivisa.update_delivery_options()
      ivisa.update_price();
    });
   
    
    // Phone Number fields
    $parent.find('[data-ivisa-validation-type="phone_number"]').each(function(){
      $(this).intlTelInput({
        utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/11.0.14/js/utils.js",
        separateDialCode: true
      });
    });
    
  }
  
  this.prefill_applicant_fields = function(trav_num, prefill, create_hidden_fields){
    var $wrapper = $('.ivisa-applicant-fields[data-template="false"]');
    if($wrapper.length <= trav_num)
      return ivisa.log('Unable to prefill, bad trav_num')

    ivisa.prefill_fields($($wrapper.get(trav_num)), prefill, create_hidden_fields);
  };
  
  this.prefill_fields = function($wrapper, prefill, create_hidden_fields){
    $.each(prefill, function(field_name, val){
      var $field = $wrapper.find('[data-ivisa-name="'+field_name+'"]')
      if($field.length == 0){
        if(create_hidden_fields === true)
          $wrapper.append($('<input type="hidden" data-ivisa-name="'+field_name+'" />').val(val));
        return;
      }
      
      if($field.hasClass('ivisa-fieldset-wrapper')){
        var $fieldset_list = $field.find('.ivisa-fieldset-entry');
        $.each(val, function(entry_num, entry_values){
          var $fieldset = $($fieldset_list[entry_num]).removeClass('ivisa-hidden');
          $.each(entry_values, function(entry_name, entry_value){
            ivisa.set_field_value($fieldset.find('[data-ivisa-name="'+entry_name+'"]'), entry_value);
          })
        })     
      }
      else
        ivisa.set_field_value($field, val)
    })
  };
  
  this.init_embassy_registration = function(){
    var c = ivisa.app_config.destination_country_name
    var tooltip = '<p>The government encourages all of its citizens travelling to '+c+' to notify the closest Embassy or Consulate to:</p> <ul> <li>Expedite the application process to renew or replace your passport if it is lost or stolen in '+c+'</li> <li>Notify you of any emergency or evacuation situation in '+c+'</li> <li>Contact your family back home in case you have an emergency in '+c+'</li> <li>Contact you in '+c+' if there is an emergency back home</li> </ul> <p> Within 24 hours of submitting your application, you will receive an email confirmation regarding your enrollment with the Embassy.</p>';
    $('#ivisa-embassy-registration-tooltip').data('content', tooltip)
  }

  this.update_delivery_options = function(){
    if(ivisa.app_config.order_type == 'passport_photo')
      return;
    
    var attr = 'data-ivisa-delivery-option-wrapper';
    
    var options = ivisa.get_available_delivery_options();
    if($.isEmptyObject(options)){
      $('.ivisa-delivery-row').hide();
      $('[data-ivisa-delivery-option-wrapper="standard"]').find('input').prop('checked',true);
    } 
    else
      $('.ivisa-delivery-row').show();
      
    $('.ivisa-order-form ['+attr+']').each(function(){
      var do_type = $(this).attr(attr);
      if(typeof options[do_type] === 'undefined')
        $(this).hide();
      else {
        $(this).find('[data-ivisa-delivery-option-available]').html(options[do_type]['available'])
        $(this).find('[data-ivisa-delivery-option-time]').html(options[do_type]['time'] + (do_type=='standard'? '' :' - Add <span data-ivisa-convert-currency="' + ivisa.app_config.pricing.delivery_options[do_type] + '"></span>/visa'))
        $(this).show();
      }
    })
  };
  
  this.get_available_delivery_options = function(){
    // Find the most restrictive set of options based on Visa Types & Nationalities & Speeds
    var allowed = {};
    var visa_types = window.ivisa_api_output['visa_types'];
    
    $.each(ivisa.get_traveler_list(), function (i, trav){
      if(typeof trav['visa_type'] == 'undefined')
        return;
      
      var visa_type = trav.visa_type;
      var vt_info = visa_types[visa_type]

      $.each(vt_info.delivery_options, function(do_type, do_info){
        if(ivisa.is_delivery_option_enabled(do_type, do_info, vt_info) == false){
          return;
        }
        
        if(typeof allowed[visa_type] == 'undefined')
          allowed[visa_type] = [];
        
        allowed[visa_type].push(do_type)
      })
    });
    
    var list = {};
    $.each(window.ivisa_api_output.delivery_options, function(do_type, do_name){
      var good = true;
      var do_info = null;
      $.each(allowed, function(visa_type, do_types){
        if($.inArray(do_type, do_types) === -1){
          good = false; // Make sure all selected visa types support this delivery option
          return;
        }
        var local_info = visa_types[visa_type]['delivery_options'][do_type];
        if(do_info === null || do_info.time_minutes < local_info.time_minutes) // Slowest delivery option
          do_info = local_info
      })
      
      if(!$.isEmptyObject(allowed) && good)
        list[do_type] = do_info;
    });
    
    return list;
  };
  
  this.init_paypal = function(){
    window.paypalCheckoutReady = function (){        
        paypal.Button.render({
          env: ivisa.app_config.is_sandbox? 'sandbox':'production',
          style: { color:'gold', shape:'pill', size: 'small' },
          
          payment: function(resolve, reject) {
            if(ivisa.paypal_charge_token != null){
              resolve(ivisa.paypal_charge_token);
            }
            else { alert("Paypal payments are not enabled e33561"); }
          },
      
          onAuthorize: function(data) {
            ivisa.payment_info = { 'mop':'paypal', 'payment_id': data.paymentID, 'payer_id': data.payerID };
            ivisa.submit_ivisa_order('submit')
          }
        }, '#ivisa-paypal-button');
    };
  }
  
  this.init_progress_bar = function(){
    ivisa.set_progress_bar(1);
  }
  
  this.capitalize = function(input, all) {
    if(typeof input != 'string' || input.length < 1)
      return input;
    input = input.replace(/_/g, " ");
    return (!!input) ? input.replace(/([^\W_]+[^\s-]*) */g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();}) : '';
  }
  
  this.humanize_field = function(str){
    if(str == null)
      return '';
    var replace = {'rush_fee':'Rush Processing','super_rush_fee':'Super Rush Processing','mail_fee':'Mail Visa','fax_fee':'Fax Visa','insurance_fee':'Traveler\'s Protection','dob':'Date of Birth','mop':'Payment Method','passport_photo_url':'Passport Photo'}
    
    if(typeof replace[str] !== 'undefined')
      return replace[str];
    
    if(str.substring(0,12)  == 'embassy_reg_')
      return str.substring(12) + ' Embassy Registration Fee';
    
    return ivisa.capitalize(str.replace('_',' '));
  }
  
  this.build_visa_confirmation_table = function(data){
    var country_codes = ivisa.app_config.country_codes
    
    //---- Contact Info Table -------- //
    var $t = $("div#review_order_info").html('');
    var skip_keys = ['traveler_list','destination_country','order_type','currency','country']
    $.each(data, function(key, val){
      if($.inArray(key, skip_keys) === -1  && val != null && val.length>0){
        var out = val;
        if(key == 'cc_friends'){
          out = [];
          $.each(val, function(j, entry){ out.push(entry.email) })
        }
        if(key.indexOf('country') != -1 && out.length == 2)
          out = country_codes[out];
        else if((key=='dob' || key.indexOf('date') != -1) && out.length == 10)
          out = ivisa.pretty_date(out);
        
        if(typeof out == 'object')
          out = out.join(', ')
        else if(key != 'email')
          out = ivisa.__(ivisa.capitalize(out, true));
        $t.append('<div class="col-xs-6 col-md-3 ivisa-verify-field-name"><span>' + ivisa.__(ivisa.humanize_field(key)) + '</span></div><div class="col-xs-6 col-md-3 field_value"><span>' + out + '</span></div>')
      }
    })
    
    // ---- Applicant Info Table -------- //
    $t = $("table#review_order_applicants").html('');
    $t_inline = $("#review_order_applicants_inline").html('');
    
    var headers = [];
    for(var key in data['traveler_list'][0])
      if(data['traveler_list'][0].hasOwnProperty(key) && key !='$$hashKey')
        headers.push(key);
    
    var header_row = '<tr>';
    $.each(headers, function(j, field_name){
      header_row += '<th>' + ivisa.__(ivisa.humanize_field(field_name)) + '</th>'; 
    });
    $t.append(header_row + '</tr>');
    
    if(headers.length <= 10){ // uses responsive, or forces tall version
      $t.addClass('hidden-xs hidden-sm')
      $t_inline.addClass('hidden-md hidden-lg')
    }
    else {
      $t.addClass('ivisa-hidden')
    }
    
    $.each(data['traveler_list'], function(i, applicant_data){
      var row = '<tr>';
      $t_inline.append("<h3>Applicant #" + (i+1) + "</h3>")
      
      $.each(headers, function(j, field_name){
        var out = applicant_data[field_name];
        if(typeof out == 'undefined')
          out = '';
        
        if(field_name.indexOf('country') != -1 && out.length == 2)
          out = country_codes[out];
        else if((field_name=='dob' || field_name.indexOf('date') != -1) && out && out.length == 10)
          out = ivisa.pretty_date(out);
        else if(field_name == 'passport_photo_url')
          out = '<img style="max-width:100px" src="'+out+'" />';
        else if(field_name == 'passport_photo')
          out = '<img style="max-width:100px" src="'+window['thumbnail_' + out]+'" />';
        else
          out = ivisa.__(ivisa.capitalize(out, true))
        
        row += '<td>' + out + '</td>'
        
        if(out.length > 0)
          $t_inline.append('<div class="row"><div class="col-xs-6 ivisa-verify-field-name"><span>' + ivisa.humanize_field(field_name) + '</span></div><div class="col-xs-6 field_value"><span>' + out + '</span></div></div>');
      })

      $t.append(row + '</tr>');
    });
    
    // ---- Price Breakdown Table -------- //
    $t = $("table#review_order_pricing").html('');
    headers = ['Product','Total'];
    header_row = '<tr>';
    $.each(headers, function(j, field_name){ header_row += '<th>' + ivisa.__(ivisa.humanize_field(field_name)) + '</th>';  })
    $t.append(header_row + '</tr>');
    
    $.each(data['fees_applied'], function(name, fee_info){
      var product_info = {'Product': ivisa.__(ivisa.humanize_field(name)) };
      if(fee_info.hasOwnProperty('unit_price'))
        product_info['Total'] = data.currency + ' ' +(parseFloat(fee_info.unit_price) * fee_info.qty).toFixed(2);
      else if(fee_info.hasOwnProperty('prices')){
        var totz = 0;
        $.each(fee_info.prices, function(i,bucket){
          totz += parseFloat(bucket.unit_price) * bucket.qty;
        })
        product_info['Total'] = data.currency + ' ' + totz.toFixed(2);
      }
        
      var row = '<tr>';
      $.each(headers, function(j, field_name){
        row += '<td>' + product_info[field_name] + '</td>'
      })

      $t.append(row + '</tr>');
    })
    
  };

  this.set_progress_bar = function(step, add_on_text){
    $('.ivisa-arrow-box').removeClass('ivisa-arrow-box-active ivisa-themed-progress-with-after');
    $('.ivisa-arrow-box').addClass('ivisa-arrow-box-inactive ivisa-themed-text');

    var stepId = '#ivisa-progress-step' + step;
    $(stepId).removeClass('ivisa-arrow-box-inactive ivisa-themed-text');
    $(stepId).addClass('ivisa-arrow-box-active ivisa-themed-progress-with-after');
  }
  
  this.format_currency = function(amount, currency){
    if(amount == '???')
      return '???';
    
    if(currency == null || currency.length != 3)
      currency = ivisa.currency;
    
    return  currency + ' ' + parseFloat(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  
  this.convert_currency = function(price_usd, to_currency){
    if(to_currency == 'USD')
      return parseFloat(price_usd).toFixed(2); 
    else {
      if(!ivisa.app_config.currency_exchange_rates.hasOwnProperty(to_currency))
        return alert('Error: Currency unknown. Please report the problem. Error 833');
      
      var val = parseFloat(price_usd) *  ivisa.app_config.currency_exchange_rates[to_currency]; 
      return ivisa.round2(val)
    }
  }
  
  this.round2 = function(val){
    val = parseFloat(val)
    return (+(Math.round(val.toFixed(6) + "e+2")  + "e-2")).toFixed(2)
  }
  
  this.group_prices_into_buckets = function(prices){
    var price_buckets = [];
    $.each(prices, function(i, the_price){
      var found = false;
      $.each(price_buckets, function(j, bucket_price){
        if(bucket_price.unit_price == the_price.toFixed(2)){
          found = true;
          price_buckets[j].qty += 1;
        }
      })
      if(!found)
        price_buckets.push({ 'unit_price': the_price.toFixed(2), 'qty': 1});
    })
    return price_buckets;
  }

  this.get_product_add_on_prices = function(default_qty){
    
    var fees = {};
    $("[data-ivisa-price]").each(function(){
      var fee_name = '';
      var fee_amount = 0;
      var item_qty = default_qty;
      var $t = $(this);
      if($t.is("input") && ($t.attr("type") == 'radio' || $t.attr('type') == 'checkbox') && $t.is(":checked")){
        var price_type = 'total_price';
        if(parseInt($t.data('qty')) > 0)
          item_qty = parseInt($t.data('qty'));
        if($t.attr('per-qty') != "false")
          price_type = 'unit_price';
        
        fee_name = $t.attr('name');
        if(fee_name === undefined)
          fee_name = $t.attr('data-ivisa-name');
        fee_amount = $t.attr('data-ivisa-price');
      }
      else if($t.is("option") && $t.is(":selected")){
        var $select = $t.closest("select");
        if(!isNaN(parseInt($t.data('qty'))))
          item_qty = $t.data('qty')
        else if(!isNaN(parseInt($select.data('qty'))))
          item_qty = $select.data('qty');
        if($t.attr('per-qty') != "false")
          price_type = 'unit_price';
        
        fee_name = $select.attr('name')
        if(fee_name === undefined)
          fee_name = $select.attr('data-ivisa-name');
        fee_amount = $select.find('option:selected').attr('data-ivisa-price');
      }
      
      if(isNaN(fee_amount))
        fee_amount = 0;
      
      if(item_qty == 0 || fee_amount === 0 || fee_amount === "0" || fee_amount === "0.0" || fee_amount === "0.00")
        return;
      
      if($t.attr('data-ivisa-discount-eligible') == "1")
        fee_amount = ivisa.round2(parseFloat(fee_amount) * parseFloat(ivisa.app_config.pricing['discount_multiplier']))
          
      if(fee_name != ''){
        // Combine fees if the fee_name already exists
        if(typeof fees[fee_name] !== 'undefined' && typeof fees[fee_name][price_type] !== 'undefined'){
          if(fees[fee_name][price_type] == fee_amount)
            item_qty += fees[fee_name]['qty'];
          else
            alert('Error: Fee mismatch detected e8086');
        }
        
        fees[fee_name] = { 'qty' : item_qty };
        fees[fee_name][price_type] = fee_amount;
      }
      
    })
    return fees;
  }
  
  this.add_applicant = function(){
    var $new_app = $('.ivisa-applicant-fields[data-template="true"]:first').clone().attr('data-template','false').css('display','block')
    $new_app.insertAfter('.ivisa-applicant-fields:last')
    ivisa.init_input_widgets($('.ivisa-applicant-fields:last'))
    ivisa.applicant_count_changed()
  }
  
  this.remove_applicant = function(el){
    $(el).closest('.ivisa-applicant-fields').remove();
    ivisa.applicant_count_changed()
  }
  
  this.applicant_count_changed = function(){
    ivisa.set_applicant_numbers();    
    ivisa.update_embassy_registration_options()
    ivisa.update_price()
  }
  
  this.set_applicant_numbers = function(){
    var num = 1;
    var total = $('.ivisa-applicant-fields[data-template="false"]').length;
    $('.ivisa-applicant-fields[data-template="false"] .ivisa-applicant-number').each(function(){
      $(this).html(num)
      $(this).closest('.ivisa-applicant-fields').find('.ivisa-remove-applicant-btn').css('display', total==1? 'none':'inline-block')
      num++;
    })
  }
  
  this.init_fieldset_repeat = function($wrapper){
    $wrapper.find('.ivisa-fieldset-add-btn').click(function(){
      $wrapper.find('.ivisa-fieldset-entry.ivisa-hidden:first').removeClass('ivisa-hidden')
    })
    $wrapper.find('.ivisa-fieldset-remove-btn').click(function(){
      if($wrapper.find('.ivisa-fieldset-entry:not(".ivisa-hidden")').length > 1)
        $wrapper.find('.ivisa-fieldset-entry:not(".ivisa-hidden"):last').addClass('ivisa-hidden')
    })
  };
  
  this.init_show_if = function($section){
    $section.find('[data-ivisa-show-if]').each(function(){
      var $field_to_show = $(this).closest('.ivisa-input-wrapper');
      if($(this).hasClass('ivisa-conditional-caption') || $(this).hasClass('ivisa-fieldset-wrapper') || $(this).hasClass('ivisa-upload-widget-wrapper') || $(this).is("option"))
        $field_to_show = $(this);
      
      var show_if = $(this).data('ivisa-show-if');
      var $target = $section.find('[data-ivisa-name="'+show_if.field_name+'"]')
      $target.bind('change', function(){
        if(ivisa.does_condition_match(show_if, ivisa.get_input_value(this))){
          $field_to_show.removeClass('ivisa-hidden');
          if($field_to_show.is("option"))
            ivisa.show_select_option($field_to_show, true);
        }
        else {
          $field_to_show.addClass('ivisa-hidden')
          if($field_to_show.is("option"))
            ivisa.show_select_option($field_to_show, false);
        }
        
        if($field_to_show.is("option"))
          $field_to_show.closest("select").val("").change();

        ivisa.hide_unnecessary_divider_lines()
      });
      
      if($field_to_show.is("option") == false) // Performance hack
        $target.change();
    })
  };
  
  this.show_select_option = function($opt, show){ // Hack for Internet Explorer 9,10,11
    return show?  $opt.filter( "span > option" ).unwrap() :
                  $opt.filter( ":not(span > option)" ).wrap( "<span>" ).parent().addClass('ivisa-hidden') ;
  };
  
  this.does_condition_match = function(condition_info, val){
    if(condition_info.condition == "equals"){
      if(val == condition_info.value)
        return true;
      else
        return false;
    }
    else if(condition_info.condition == "not_equal"){
      if(val != condition_info.value)
        return true;
      else
        return false;
    }
    else if(condition_info.condition === "greater_than"){
      if(parseFloat(val) > parseFloat(condition_info.value))
        return true;
      else
        return false;
    }
    else if(condition_info.condition === "less_than"){
      if(parseFloat(val) < parseFloat(condition_info.value))
        return true;
      else
        return false;
    }
    else if(condition_info.condition == "in_list"){
      if($.inArray(val, condition_info.value) === -1)
        return false;
      else
        return true;
    }
    else if(condition_info.condition == "not_in_list"){
      if(val != null && val.length && $.inArray(val, condition_info.value) === -1)
        return true;
      else
        return false;
    }
    else if(condition_info.condition == 'not_empty'){
      if(val == null || val.length === 0)
        return false;
      else
        return true;
    }
    else
      alert('Unknown ivisa condition match')
  };
  
  this.is_field_visible = function($el){
    // Is a field active/accessible to the user?
    if($el.closest('.ivisa-input-wrapper').hasClass('ivisa-hidden'))
      return false;
    
    if($el.closest('.ivisa-fieldset-wrapper').hasClass('ivisa-hidden'))
      return false;
    
    if($el.closest('.ivisa-fieldset-entry').hasClass('ivisa-hidden'))
      return false;
    
    if($el.closest('.ivisa-upload-widget-wrapper').hasClass('ivisa-hidden'))
      return false;
    
    if($el.closest('section').attr('data-template') == 'true')
      return; // This is blank template
    
    return true;
  }

  this.hide_unnecessary_divider_lines = function(){
    // If all inputs in the row are hidden, hide the divider
    $('.ivisa-row-divider-top, .ivisa-row-divider-bottom').each(function(){
      var d = $(this).find('div');
      var is_collapsed = $(this).hasClass('ivisa-hide-divider');
      if(d.length === d.filter('.ivisa-hidden').length){
        if(!is_collapsed)
          $(this).addClass('ivisa-hide-divider')
      }
      else if(is_collapsed)
        $(this).removeClass('ivisa-hide-divider')
    })

  };

  this.back_to_step1 = function(){
    $('.ivisa-instr-step2').hide();
    $('.ivisa-instr-step1').show();
    
    $('.ivisa-review-and-pay').hide();
    $('.ivisa-before-review').show();
    
    ivisa.scroll_to_top();
    ivisa.set_progress_bar(1);
  }
  
  this.show_form_submit_spinner = function(){
    ivisa.show_error_message(''); // reset in case this isn't their first attempt
    
    $('.btn').attr('disabled','disabled').addClass("disabled")
    $('.ivisa_submit_error_message').css('opacity',0)
    $('.ivisa-submit-spinner').show()
    $('.ivisa-hide-during-ajax').css('opacity',0)
  }
  
  this.hide_form_submit_spinner = function(){
    $('.ivisa-submit-spinner').hide()
    $('.btn').removeAttr('disabled').removeClass("disabled")
    $('.ivisa-hide-during-ajax').css('opacity',1)
  }
  
  this.get_missing_fields = function($wrapper, add_missing_class){
    var missing_required_fields = [];
    $wrapper.find('input, select, textarea').each(function(){
      var field_name = $(this).attr('data-ivisa-name');
      var val = ivisa.get_input_value(this);
      
      if($(this).attr('data-ivisa-required') == "true" && (val == null || val.length === 0) && ivisa.is_field_visible($(this))){
        missing_required_fields.push(field_name)
        if(add_missing_class !== false)
          $(this).closest('.ivisa-input-wrapper').addClass('ivisa-missing-required');
      }
      else {  
        if(add_missing_class !== false)
          $(this).closest('.ivisa-input-wrapper').removeClass('ivisa-missing-required')
      }
    })
   
    return missing_required_fields;
  }
  
  this.highlight_field_error = function(field_info){
    var $wrapper = $("#ivisa-global-fields"); // Global fields
    
    if(field_info.trav_num !== undefined && field_info.trav_num != null){
      $wrapper = $('.ivisa-applicant-fields[data-template="false"]').filter(':nth('+ field_info.trav_num +')');
    }
    
    $wrapper.find('[data-ivisa-name="'+field_info.field_name+'"]').addClass('ivisa-missing-required')
  }
  
  this.validate_responses = function($wrapper, add_missing_class){
    
    var missing_required_fields = ivisa.get_missing_fields($wrapper, add_missing_class);
    
    if(missing_required_fields.length > 0)
      return ivisa.show_error_message(ivisa.missing_required_fields_msg, missing_required_fields);
    
    // TODO more validation
    
    if(typeof ivisa.extra_form_validation == 'function'){
      var extra = ivisa.extra_form_validation();
      if(extra !== false)
        return ivisa.show_error_message(extra);
    }
    
    return true;
  }
  
  this.submit_ivisa_order = function(ivisa_action, validate, extra_data){
    if(validate == null)
      validate = true;
    
    ivisa.show_form_submit_spinner();
    
    if($('.ivisa-prevent-submission-message:not(".ivisa-hidden")').length)
      return ivisa.show_error_message('You are not allowed to proceed. See the error message above');
    
    // Validation
    if(validate !== false && ivisa.validate_responses($('.ivisa-order-form .ivisa-form-section'), true) !== true){
      return false;
    }
    
    $('.ivisa-missing-required').removeClass('ivisa-missing-required')
    
    // Save the data
    var data = { 'order_type': ivisa.app_config.order_type };
    data['global_fields'] = {};
    $('#ivisa-global-fields input, #ivisa-global-fields select, #ivisa-global-fields textarea').each(function(){
      data['global_fields'][$(this).attr('data-ivisa-name')] = ivisa.get_input_value(this);
    })
    
    data['applicants_fields'] = ivisa.get_traveler_list();
    data['destination_country'] = ivisa.destination_country_code();
    if(ivisa.app_config.order_type =='visa' && (data['destination_country'] == null || data['destination_country'].length != 2))
      return ivisa.show_error_message("destination_country field not specified")
  
    // Pricing and delivery options
    data['total_price'] = ivisa.calculate_total_price()
    data['currency'] = ivisa.currency
    data['delivery_method'] = ivisa.get_order_delivery_method()
    
    data['embassy_registration'] = [];
    $('#ivisa-embassy-addon-list input:checked').each(function(){
      data['embassy_registration'].push($(this).attr('data-ivisa-name').slice(-2));
    })
    
    // Updating an Existing Order?
    if(typeof ivisa.app_config.order_id != 'undefined')
      data['order_id'] = ivisa.app_config.order_id;
    
    if(typeof extra_data == 'object' && extra_data != null){
      for(var key in extra_data){
        if(extra_data.hasOwnProperty(key) && typeof data[key] == 'undefined')
          data[key] = extra_data[key]
      }
    }
    
    ivisa.log(data)
    
    if(ivisa_action == 'submit' && ivisa.require_user_payment === true){
      if(typeof ivisa.payment_info == 'object' && ivisa.payment_info != null)
        data['payment_info'] = ivisa.payment_info
      else
        return ivisa.handle_payment(ivisa.mop, data['total_price'], data['currency']);
    }
    
    $.ajax({ url: ivisa.get_endpoint_for_action(ivisa_action) + '&' + ivisa.form_submission_url_append, type:'post', dataType:'json', data: {"json": JSON.stringify(data) } })
      .always(function(resp){
        ivisa.hide_form_submit_spinner();
        ivisa.log(resp)
        if(typeof resp['error_msg'] != 'undefined'){
          ivisa.show_error_message(resp.error_msg);
          if(typeof resp['currency_exchange_rates'] != 'undefined'){
            ivisa.app_config.currency_exchange_rates = resp.currency_exchange_rates 
            ivisa.update_price()
          }
          if(resp.field_name !== undefined)
            ivisa.highlight_field_error(resp)
        }
        else if(typeof resp['responseJSON'] != 'undefined' && typeof resp.responseJSON['error_msg'] != 'undefined')
          ivisa.show_error_message(resp.responseJSON.error_msg);
        else if(typeof resp['success'] == 'undefined' || resp.success !== true)
          ivisa.show_error_message('An unknown error has occurred. e65525');
        else {
          window.onbeforeunload = null;
          if(ivisa_action == 'validate')
            ivisa.order_validation_successful(resp, data);
          else if(ivisa_action == 'update_existing_visa_application')
            ivisa.multipart_save_successful(resp, data);
          else
            ivisa.order_submission_successful(resp);
        }
      });
    
    return true;
  };
  
  this.get_endpoint_for_action = function(ivisa_action){
    var url = ivisa.api_domain;
    if(ivisa.ajax_form_submission_url.length > 0)
      url += ivisa.ajax_form_submission_url.length + '?ivisa_action=' + ivisa_action + '&';
    else {
      url += '/api/' + ivisa_action +'?';
    }
    
    return url + 'r='+Math.floor((Math.random()*10000))
  }
  
  this.get_traveler_list = function(){
    var list = [];
    $('.ivisa-applicant-fields[data-template="false"]').each(function(){
      var trav = {};
      $(this).find('input, select, textarea').each(function(){
        if(!ivisa.is_field_visible($(this)))
          return; // hidden input
  
        var val = ivisa.get_input_value(this);
        if(typeof val === 'string' && (val === null || val.length === 0))
          return;
        
        if($(this).closest('.ivisa-fieldset-wrapper').length != 0){
          // This value is part of a field set and will be nested under its parent
          var $wrapper = $(this).closest('.ivisa-fieldset-wrapper');
          var parent_field = $wrapper.attr('data-ivisa-name');
          var entry_num = parseInt($(this).closest('.ivisa-fieldset-entry').attr('data-ivisa-fieldset-entry-num'));
          if(typeof trav[parent_field] == 'undefined')
            trav[parent_field] = [];
          if(typeof trav[parent_field][entry_num] == 'undefined')
            trav[parent_field][entry_num] = {};
          trav[parent_field][entry_num][$(this).attr('data-ivisa-name')] = val; 
        }
        else {
          trav[$(this).attr('data-ivisa-name')] = val;
        }
      })
      list.push(trav)
    })
    
    return list;
  }
  
  this.get_order_delivery_method = function(){
    // This function can be overriden by subclass if not allowing the customer to choose
    if(ivisa.app_config.order_type == 'passport_photo')
      return ivisa.get_input_value($('[data-ivisa-name="delivery_method"]'));
    else
      return ivisa.get_input_value($('[name="ivisa_delivery_option"]'));
  }
  
  
  this.update_visa_validity_info = function(){
    $('[data-ivisa-name="visa_validity"]').each(function(){
      var $parent = $(this).closest('.ivisa-form-section')
      if($parent.attr('data-template') == "true")
        return; // Don't make any changes to the template applicant
      
      var visa_type = ivisa.get_input_value($parent.find('[data-ivisa-name="visa_type"]'))
      var passport_expiration = ivisa.get_input_value($parent.find('[data-ivisa-name="passport_expiration_date"]'))
      var nationality = ivisa.get_input_value($parent.find('[data-ivisa-name="nationality_country"]'));
      var dob = ivisa.get_input_value($parent.find('[data-ivisa-name="dob"]'));
      var validity_string = ivisa.calculate_visa_validity(visa_type, ivisa.get_input_value($('[data-ivisa-name="arrival_date"]')), nationality, passport_expiration);
      
      var costs = ivisa.calculate_price_for_traveler({ 'nationality_country': nationality, 'visa_type':visa_type, 'dob': dob });
      if(costs !== null && validity_string.length > 0){
        visa_cost = parseFloat(ivisa.convert_currency(costs.visa_cost, ivisa.currency));
        service_fee = parseFloat(ivisa.convert_currency(costs.service_fee, ivisa.currency));
        var trav_price = ivisa.round2(visa_cost + service_fee) + ' ' + ivisa.currency;
        
        $(this).html(trav_price +'. '+validity_string)
      }
      else
        $(this).html('')
      
    })
  }
  
  this.destination_country_code = function(){
    return ivisa.app_config.destination_country_code;
  }
  
  this.calculate_visa_validity = function(visa_type, arrival_date, nationality, passport_expires){
    if(visa_type=='' || arrival_date == '')
      return "";
    if(typeof window.ivisa_api_output['visa_types'] == 'undefined')
      return alert('Visa types database not loaded');
    else if(typeof window.ivisa_api_output['visa_types'][visa_type] == 'undefined')
      return "";
    
    var info = $.extend(true, {}, window.ivisa_api_output['visa_types'][visa_type]);
    if(info.validity_overrides !== undefined && info.validity_overrides[nationality] !== undefined)
      info.validity = $.extend(info.validity, info.validity_overrides[nationality]);
    
    if(info.validity.expires_type == 'before_passport_expiration' && (passport_expires==null || passport_expires.length==0))
      return "";
    
    var entry = info.validity.num_entries;
    if(info.validity.num_entries == 1)
      entry = 'single';
    else if(info.validity.num_entries == 2)
      entry = 'double';
    else if(info.validity.num_entries == 3)
      entry = 'triple';
    else if(info.validity.num_entries == 99)
      entry = 'multiple'
    
    var today = new Date();
    
    var start_date = "";
    if(info.validity.starts == 'today')
      start_date = today.getFullYear() + '-' + (today.getMonth()+1) + '-' + (today.getDate()<=9?'0':'') + today.getDate()
    else if (typeof arrival_date != 'undefined')
      start_date = arrival_date;
    else
      return "";
    
    var end_date = ivisa.add_days(start_date, info.validity.duration);
    if(info.validity.expires_type == 'before_passport_expiration')
      end_date = ivisa.add_days(passport_expires, -1 * info.validity.duration);
    
    return ivisa.__("Visa valid for " +entry+" entry between")+' '+ivisa.pretty_date(start_date)+' '+ivisa.__("and")+' '+ ivisa.pretty_date(end_date);
  
  };
  

  //Accepts yyyy-mm-dd only
  this.add_days = function(date_str, days){
   var chunks = date_str.split('-');
   
   var d = new Date(chunks[0], parseInt(chunks[1])-1, parseInt(chunks[2]), 0,0,0,0);
   
   d.setTime(d.getTime() + days * 86400000 );
   var month = (d.getMonth()+1);
   
   return d.getFullYear() + '-' + (month<=9?'0':'') + month + '-' + (d.getDate()<=9?'0':'') + d.getDate();
  }
  
  //Accepts yyyy-mm-dd only
  this.pretty_date = function(date_str){
   var chunks = date_str.split('-');
   var month = parseInt(chunks[1]) -1;
   var names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
   
   if(typeof window.month_names != 'undefined' && window.month_names[0] != 'January')
     names = window.month_names;
   
   return names[month]+'-'+parseInt(chunks[2])+'-'+chunks[0];
  }

  this.get_input_value = function(inp){
    var $inp = $(inp);
    if(typeof $inp === 'object' && ($inp === null || $inp.length === 0))
      return null;
    
    if($inp.prop('tagName') == 'SELECT'){
      return $inp.find('option:selected').val()
    }
    else if($inp.is(":input")){
      if($inp.attr('type') == 'checkbox')
        return $inp.is(':checked')? "1":'';
      else if($inp.attr('type') == 'file'){
        var filename = $inp.attr('data-ivisa-uploaded-file');
        if(filename == null || filename.length < 1)
          return '';
        else
          return filename;
      }
      else if($inp.attr('type') == 'radio'){
        var radio_name = $inp.attr('name')
        if($inp.length == 1)
          $inp = $inp.closest('.ivisa-input-wrapper').find('input[name="'+radio_name+'"]');
        return $inp.filter(':checked').length==0? '':$inp.filter(':checked').val();
      }
      else if(typeof $inp['intlTelInput'] === 'function' && $inp.parent().hasClass('intl-tel-input')){
        if($inp.val() == '')
          return "";
        return $inp.intlTelInput("getNumber")
      }
      else
        return $inp.val();
    }
    else
      alert('Unknown input type')
  };
  
  this.set_field_value = function(inp, val){
    var $inp = $(inp);
    if(typeof $inp === 'object' && ($inp === null || $inp.length === 0))
      return null;
    
    if($inp.is(":input")){
      if($inp.attr('type') == 'checkbox')
        return $inp.prop('checked', val? true : false).change();
      else if($inp.attr('type') == 'file'){
        $inp.attr('data-ivisa-uploaded-file', '1')
        ivisa.set_image_upload_preview($inp, val);
        return;
      }
      else if($inp.attr('type') == 'radio')
        return $inp.filter('[value="'+val+'"]').prop('checked', true).change();
      else
        return $inp.val(val).change();
    }
    else if($inp.is(':option'))
      return $inp.val(val).change()
    else
      alert('Unknown input type')
  }
  
  this.show_error_message = function(msg, invalid_fields){
    ivisa.log(msg)
    ivisa.hide_form_submit_spinner();
    
    $('.ivisa_submit_success_message').hide();
    
    if(typeof ivisa.override_show_error_message == 'function')
      return ivisa.override_show_error_message();
    
    if(msg != null && msg.length){
      $('.ivisa_submit_error_message').html(msg).show().css('opacity',1)
    }
    else
      $('.ivisa_submit_error_message').css('opacity',0)
    
    
    // --- Google Analytics Tracking GTM ----
    if(invalid_fields == null || typeof invalid_fields == 'string' || invalid_fields.length == 0)
      invalid_fields = [''];
    
    var sent = []
    $.each(invalid_fields, function(i,field){
      if(field instanceof HTMLElement){
        var $f = $(field);
        field = $f.attr('ng-model'); 
        if(field == null)
          field = $f.attr('name')
      }
      
      if(typeof field != 'string' || field == null)
        field = '';
      
      var track_msg = field + (field.length? ':':'') + msg;
      if($.inArray(track_msg, sent) === -1)
        ivisa.gtrack(ivisa.app_config.order_type + '_form', track_msg, 'form_error')
      sent.push(track_msg)
    });
    // --------------------------------
    
    return false;
  };
  
  this.init_prevent_submission_if = function($el){
    var prevent_if = $el.data('ivisa-prevent-submission-if');
    var $container = $el.closest('.ivisa-input-wrapper');
    var $msg_box = $container.find('.ivisa-prevent-submission-message');
    if($msg_box == null || !$msg_box.length)
      $msg_box = $("<div class='ivisa-hidden ivisa-prevent-submission-message'>"+ $('<div/>').text(prevent_if.message).html() +"</div>").appendTo($container);
      
    $el.closest('.ivisa-form-section').find('[data-ivisa-name="'+prevent_if.field_name+'"]').bind('change', function(){
      if(ivisa.does_condition_match(prevent_if, ivisa.get_input_value(this)))
        $msg_box.removeClass('ivisa-hidden')
      else if(!$msg_box.hasClass('ivisa-hidden'))
        $msg_box.addClass('ivisa-hidden')
    }).change();
      
    return;
  };
  
  this.update_price = function(){
    ivisa.update_price_currencies();
    var formatted = ivisa.format_currency(ivisa.calculate_total_price(), ivisa.currency);
    $('.ivisa-total-price').html(formatted);
    
    $('.ivisa-traveler-count').html(ivisa.get_traveler_list().length)
    ivisa.update_visa_validity_info();
  }
  
  
  this.pricing = {
      visa_cost : function(nationality, visa_type, extras){
        var p = ivisa.app_config.pricing;
        var visa_type_overrides = (p['visa_type_overrides'][visa_type] !== undefined)? p['visa_type_overrides'][visa_type] : [];
        var base = (visa_type_overrides['base_visa_cost'] !== undefined)? visa_type_overrides['base_visa_cost'] : p['base_visa_cost'];
        
        var nationality_modifier = (p['nationality_visa_costs'][nationality] !== undefined)? p['nationality_visa_costs'][nationality] : 0;
        if(visa_type_overrides['nationality_visa_costs'] !== undefined && visa_type_overrides['nationality_visa_costs'][nationality] !== undefined)
          nationality_modifier = visa_type_overrides['nationality_visa_costs'][nationality];
            
        var age_modifier = (extras['age'] !== undefined && p['age_visa_cost_modifiers'][extras['age']] !== undefined)? p['age_visa_cost_modifiers'][extras['age']] : 0;
        var total = parseFloat(base) + parseFloat(nationality_modifier) + parseFloat(age_modifier);
        return Math.max(0, ivisa.round2(total));
      },
      
      service_fee : function(nationality, visa_type, extras){
        var p = ivisa.app_config.pricing;
        var visa_type_overrides = (p['visa_type_overrides'][visa_type] !== undefined)? p['visa_type_overrides'][visa_type] : [];
        var base = (visa_type_overrides['base_service_fee'] !== undefined)? visa_type_overrides['base_service_fee'] : p['base_service_fee'];
        
        var nationality_modifier = (p['nationality_service_fees'][nationality] !== undefined)? p['nationality_service_fees'][nationality] : 0;
        if(visa_type_overrides['nationality_service_fees'] !== undefined && visa_type_overrides['nationality_service_fees'][nationality] !== undefined)
          nationality_modifier = visa_type_overrides['nationality_service_fees'][nationality];
        
        var total = parseFloat(base) + parseFloat(nationality_modifier) + ivisa.pricing.get_domain_specific_service_fee_modifier(nationality, ivisa.destination_country_code());
        total *= parseFloat(p['discount_multiplier']);
        return Math.max(0, ivisa.round2(total));
      },
      
      passport_photo_cost : function(num_copies){
        if(num_copies === undefined)
          return 0;
        
        var p = ivisa.app_config.pricing;
        var total = ivisa.app_config.pricing.passport_photo_prices[num_copies];
        total *= parseFloat(p['discount_multiplier']);
        return Math.max(0, ivisa.round2(total));
      },
      
      get_domain_specific_service_fee_modifier : function(nationality, destination_country){
        var mod = ivisa.app_config.pricing.domain_specific_service_fee_modifier;
        return mod[destination_country] === undefined? 0.0 : parseFloat(mod[destination_country]);
      }
      
  };
  
  this.calculate_price_for_traveler = function(trav){
    var nationality_code = trav.nationality_country;
    if (nationality_code === null || nationality_code === '' || trav.visa_type === null || trav.visa_type === '') {
      return null;
    }
    
    var age = 99;
    var arrival_date = ivisa.get_input_value($('[data-ivisa-name="arrival_date"]'));
    if (trav.hasOwnProperty('dob') && trav.dob !==null && trav.dob.length > 0 &&  arrival_date !== null && arrival_date.length > 0) {
      age = Math.floor(ivisa.calculate_days_between(trav.dob, arrival_date) / 365);
      ivisa.log('age = ' + age);
    }
    
    var costs = {}
    costs.visa_cost   = ivisa.pricing.visa_cost(nationality_code, trav.visa_type, {"age":age});
    costs.service_fee = ivisa.pricing.service_fee(nationality_code, trav.visa_type);
    
    return costs;
  }
   
  
 this.calculate_total_price = function () {
    var traveler_count = ivisa.get_traveler_list().length;

    var running_total = 0;
    $.each(ivisa.get_traveler_list(), function (i, trav){
      var costs = null;
      if(ivisa.app_config.order_type == 'visa')
        costs = ivisa.calculate_price_for_traveler(trav)
      else if(ivisa.app_config.order_type == 'passport_photo')
        costs = { 'visa_cost':0, 'service_fee': ivisa.pricing.passport_photo_cost(trav.num_passport_photo_copies) };
        
      if(costs !== null){
        visa_cost = parseFloat(ivisa.convert_currency(costs.visa_cost, ivisa.currency));
        service_fee = parseFloat(ivisa.convert_currency(costs.service_fee, ivisa.currency));
        
        running_total += (visa_cost + service_fee);
      }
    });

    var add_on_prices = {};
    $.each(ivisa.get_product_add_on_prices(traveler_count), function (name, obj) {
      add_on_prices[name] = obj;
      var add_on_price = parseFloat(ivisa.convert_currency(parseFloat(obj.unit_price), ivisa.currency));
      running_total += (add_on_price * obj.qty);
    });

    return running_total;
  };
  
  this.init_uploader = function(){
    if(typeof Evaporate == 'undefined')
      return alert('The Evaporate.js dependency is missing');
    
    ivisa._ivisa_uploader = new Evaporate({
      signerUrl: ivisa.file_upload_endpoint,
      aws_key: ivisa.app_config.uploader_aws_key,
      bucket:  ivisa.app_config.uploader_aws_bucket,
      logging: false,
      maxConcurrentParts: 3
   });
  
  };
  
  this.upload_file_selected = function(inp){
    var files = inp.files;
    var $inp = $(inp);
    if(files == null)
      return alert("No file detected. You may need to update your browser");
    if(files.length > 1)
      return alert('Please select only ONE file to upload');
    else if(files.length == 0)
      return alert("No file was selected.");
  
    $('.ivisa-hide-during-ajax').css('visibility','hidden')
    $('.ivisa-show-during-upload').show();
    
    var file_info = files[0];
    
    file_info['temp_name'] = ivisa.format_date(new Date()) + '_upload_' + String(100000 + Math.floor(1000000000*Math.random())).slice(-6) + '_' + file_info.name.replace(/[^0-9a-z-_.]+/ig, "");
    
    ivisa._ivisa_uploader.add({
      name: file_info['temp_name'],
      file: files[0],
      contentType: file_info.type,
      complete: function(){
        $('.ivisa-hide-during-ajax').css('visibility','visible')
        $('.ivisa-show-during-upload').hide();
         ivisa.upload_successful($inp, file_info)
      },
      progress: function(progress){
        ivisa.upload_progress_callback(Math.min(99.9, Math.floor(progress * 1000) / 10), $inp);
      }
    });
  
    $inp.val('');
  };
  
  this.format_date = function(date) {
      var d = new Date(date),
      month = '' + (d.getMonth() + 1),
      day = '' + (d.getDate()<=9?'0':'') + d.getDate(),
      year = d.getFullYear();
  
    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;
  
    return [year, month, day].join('-');
  }
  
  this.calculate_days_until = function(str){
    var dateFragments = str.split('-');
    if(!dateFragments || dateFragments.length != 3)
      return false;
    
    var diff = new Date(dateFragments[0] , parseInt(dateFragments[1]) - 1 , parseInt(dateFragments[2]), 0,0,0,0).getTime();
    var days = (diff - (new Date()).getTime()) / (1000 * 60 * 60 * 24);
    return Math.floor(days);
  }
  
  this.calculate_days_between = function(str1, str2){
    var dateFragments = str1.split('-');
    if(!dateFragments || dateFragments.length != 3)
      return false;
    
    var date1 = new Date(dateFragments[0] , parseInt(dateFragments[1]) - 1 , parseInt(dateFragments[2]), 0,0,0,0).getTime();
    
    dateFragments = str2.split('-');
    if(!dateFragments || dateFragments.length != 3)
      return false;
    
    var date2 = new Date(dateFragments[0] , parseInt(dateFragments[1]) - 1 , parseInt(dateFragments[2]), 0,0,0,0).getTime();
    
    var days = Math.abs(date1 - date2) / (1000 * 60 * 60 * 24);
    return Math.floor(days);
  }
  
  this.upload_progress_callback = function(pcent, $inp){
    var $status_msg = $inp.hide().closest('.ivisa-uploader-widget').find('.ivisa-upload-status');
    $status_msg.html('<div class="progress"><div class="progress-bar progress-bar-success" role="progressbar" aria-valuenow="'+pcent+'" aria-valuemin="0" aria-valuemax="100" style="width: '+pcent+'%;"><span>'+pcent+'%</span></div></div>').show();
    
    if(pcent == 100)
      setTimeout(function(){ $status_msg.hide(); $inp.show() }, 2000)
  };
  
  this.upload_successful = function($inp, file_info){  
    var trav_num = $inp.closest('.ivisa-applicant-fields').attr('data-ivisa-trav-num');
    var info = {'file_type': $inp.attr('data-ivisa-name'), 'trav_num':trav_num, 's3_key': file_info['temp_name'] };
    var endpoint = ivisa.file_upload_endpoint + '?upload_success=1';
    if(typeof ivisa.app_config.order_id != 'undefined')
      endpoint += '&order_id=' + ivisa.app_config.order_id;
    
    $.ajax({url: endpoint, data:info, 'type':'post' }).success(function(data){
       ivisa.upload_progress_callback(100, $inp);
       if(typeof data['error_msg'] !== 'undefined'){
         return alert(data['error_msg'])
       }
       else if(typeof data[info.file_type][0]['error'] !== 'undefined'){
         alert('Upload failed: ' + data[info.file_type][0]['error']);
         return;
       }
  
       $inp.attr('data-ivisa-uploaded-file', file_info['temp_name']);
       ivisa.set_image_upload_preview($inp, data[info.file_type][0]['thumbnailUrl'])
     })
  };
  
  this.set_image_upload_preview = function($inp, url){
    window['thumbnail_' + $inp.attr('data-ivisa-uploaded-file')] = url
    
    var $wrapper = $inp.closest('.ivisa-uploader-widget');
    $wrapper.find('.ivisa-example-upload').hide();
    if($wrapper.find('.ivisa-image-upload-preview').length ==1) {
      $wrapper.find('.upload_btn_text').html(ivisa.__('Change Photo'));
      $wrapper.find('.ivisa-image-upload-preview').html('<img src="'+url+'" /><br /><br /><span style="color:green">'+ivisa.__('Status: Uploaded')+'</span>');
    } else {
      $wrapper.find('.upload_btn_text').html(ivisa.__('Upload Photo'));
    }
  }
  
  this.upload_via_email = function(button){
    var $widget = $(button).closest('.ivisa-uploader-widget');
    
    if($widget.attr('data-ivisa-email-upload-id').length == 0)
      $widget.attr('data-ivisa-email-upload-id', Math.random() + "")
    
    var keyy = "started_upload" + $widget.attr('data-ivisa-email-upload-id');
    if(typeof window[keyy] != 'undefined')
      return;
    window[keyy] = keyy;
    var order_id = (typeof ivisa.app_config.order_id === 'undefined')? '':ivisa.app_config.order_id;
    var utype = $widget.attr('data-ivisa-upload-type');
    trav_num = $(button).closest('.ivisa-applicant-fields').attr('data-ivisa-trav-num');
    if(trav_num === undefined)
      trav_num = $(button).closest('.ivisa-applicant-fields').find('.ivisa-applicant-number').html()
    
    ivisa.generate_upload_address($widget, order_id, utype + '_trav' + trav_num);
  } 
  
  this.generate_upload_address = function ($widget, order_id, type){
    $widget.find('.email_upload_address').html('Generating...');

    $.ajax({url: ivisa.get_endpoint_for_action('generate_upload_email') + '&type=' + type + '&order_id='+order_id, type:'post' }).done(function(data){
      $widget.find('.email_upload_address').html('<a style="color:blue;font-size:22px" href="mailto:'+data.email+'">' + data.email + '</a> <span class="clickable glyphicons move"></span>');
      $widget.find('.wait_on_email_upload').show();
      window.email_upload_check_freq = 10;
      setTimeout(function(){ ivisa.multipart_email_status($widget, data.email) }, window.email_upload_check_freq * 1000)
    }).error(function(){ alert('Failed to create address')})
  }
  
  this.multipart_email_status = function($wrapper, email_address){
    $.ajax({url: ivisa.get_endpoint_for_action('check_email_upload') + '&address=' + encodeURIComponent(email_address), type:'post' }).done(function(data){
      if(typeof data.done != 'undefined' && data.done == false){
        window.email_upload_check_freq += 5;
        setTimeout(function(){ ivisa.multipart_email_status($wrapper, email_address) }, window.email_upload_check_freq  * 1000)
      } else {
        if(typeof data.success != 'undefined' && data.success == true){
          $wrapper.find('.wait_on_email_upload').hide();
          $wrapper.find('.email_upload_address').parent().hide();
          $wrapper.find('.ivisa-input-file-upload').attr('data-ivisa-uploaded-file', data.temp_name);
          ivisa.set_image_upload_preview($wrapper, data.thumbnailUrl)
        } else
          alert(typeof data.error === 'string'? data.error : 'An unknown error occurred waiting for your email e833');
      } 
    })
  }
  
  this.open_uploader_tab = function(el, tab_to_open){
    var $tabs = $(el).closest('.ivisa-upload-widget-wrapper').find('.tab-content');
    $tabs.find('.tab-pane').removeClass('active');
    $tabs.find('.ivisa-tab-' + tab_to_open).addClass('active')
  }
  
  this.select_element_cursor = function(el) {
    if(typeof el == 'undefined')
      return;
    
    if (window.getSelection && document.createRange) {
        var sel = window.getSelection();
        var range = document.createRange();
        range.selectNodeContents(el);
        window.getSelection().empty();
        sel.addRange(range);
    }
  }
  
  this.show_ivisa_datepicker = function(input){
	  var $inp = $(input);
	  
	  if(!$('#dp_modal').length){
	    // Initialize the shared/global modal
	    var modal = $('<div id="dp_modal" class="modal fade" tabindex="-1" role="dialog"><div class="modal-dialog"><div class="modal-content"><div class="modal-header"><h4 class="modal-title"></h4></div><div class="modal-body"></div><div class="modal-footer"><button type="button" class="btn btn-default" data-dismiss="modal">'+ivisa.__('Close')+'</button><button type="button" class="btn btn-primary" id="dp_save">'+ivisa.__('Save')+'</button></div></div></div></div>');
	    $('body').append(modal);
	  }
	  else
	    $('#dp_modal .modal-body').html('');

	  $('#dp_modal .modal-header h4').html($inp.attr('data-ivisa-label'));

	  var names = [ivisa.__('Month'),ivisa.__('Day'),ivisa.__('Year')];
	  
	  $('#dp_modal .modal-body').append('<div class="row ivisa-dprow"><div class="col-md-offset-1 col-md-2">'+names[0]+':</div><div class="col-md-5"><select id="dp_month" class="form-control"></select></div></div>');
	  $('#dp_modal .modal-body').append('<div class="row ivisa-dprow"><div class="col-md-offset-1 col-md-2">'+names[1]+':</div><div class="col-md-5"><select id="dp_day" class="form-control"></select></div></div>');
	  $('#dp_modal .modal-body').append('<div class="row ivisa-dprow"><div class="col-md-offset-1 col-md-2">'+names[2]+':</div><div class="col-md-5"><select id="dp_year" class="form-control"></select></div></div>');
	  
	  var selected = { year: 2016, month: 0, day: 0};
	  var chunks = $inp.val().split('-');
	  if(chunks != null && chunks.length == 3){
	    selected.year = parseInt(chunks[0])
	    selected.month = parseInt(chunks[1])
	    selected.day = parseInt(chunks[2])
	  }
	  
	  for(var year=1900; year < 2100; year++)
	    $('#dp_year').append("<option value='"+year+"' "+(selected.year==year? "selected='selected'":'')+">"+year+"</option>");
	  
	  var monthsFull = ['-- '+names[0]+' --'  ];
	  var month_list = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
	  if(typeof window.month_names != 'undefined')
	    month_list = window.month_names;
	  
	  $.each(month_list, function(month, name){
	    month++;
	    monthsFull.push(month + ' - ' +name)
	  })
	  
	  
	  $.each(monthsFull, function(month, name){
	    $('#dp_month').append("<option value='"+(month<=9?'0':'')+month+"' "+(selected.month==month? "selected='selected'":'')+">"+name+"</option>");
	  })
	  
	  $('#dp_day').append("<option value='0' "+(selected.day==day? "selected='selected'":'')+">-- "+names[1]+" --</option>");
	  for(var day=1; day <= 31; day++){
	    $('#dp_day').append("<option value='"+(day<=9?'0':'')+day+"' "+(selected.day==day? "selected='selected'":'')+">"+day+"</option>");
	  }

	  $('#dp_year').bind('blur', function(){
	      if(parseInt($('#dp_month').val()) > 0 && parseInt($('#dp_day').val()) > 0) {
          $('#dp_save').click();
        }
      });

	  $('#dp_save').unbind().click(function(){
	    if(parseInt($('#dp_month').val()) < 1)
	      return alert('Invalid month');
	    if(parseInt($('#dp_day').val()) < 1)
	      return alert('Invalid day of month');
	    
	    $inp.val($('#dp_year').val() + '-' + $('#dp_month').val() + '-' + $('#dp_day').val())
	    
	    $inp.trigger('change')
	    $('#dp_modal').modal('hide');
        ivisa.dp_modal_just_exited = true;
        $inp.focus()
	  })

      $('#dp_modal').on('shown.bs.modal', function () {
        $('#dp_month').focus()
      });

	  $('#dp_modal').modal('show');
	}
  
  this.get_traveler_nationalities = function(){
    var nat = [];
    
    $('.ivisa-applicant-fields [data-ivisa-name="nationality_country"] option:selected').each(function(){
      var nationality_country = $(this).val();
      if(nationality_country == null || nationality_country.length != 2)
        return;
      nat.push(nationality_country)
    });
    
    return nat;
  }
  
  this.is_delivery_option_enabled = function(do_type, do_info, visa_type_info){
    var enabled = true;
    
    if(typeof do_info['disable_nationalities'] != 'undefined'){
      $.each(ivisa.get_traveler_list(), function (i, trav){
        if(typeof trav['nationality_country'] == 'undefined' || trav.nationality_country.length != 2)
          return;
        
        if($.inArray(trav.nationality_country, do_info['disable_nationalities']) !== -1)
          enabled = false;
      });
    }
    
    if(typeof do_info['disable_arrival_more_than'] != 'undefined'){
      var arrival_date = ivisa.get_input_value($('[data-ivisa-name="arrival_date"]'))
      if(!arrival_date || arrival_date.length == 0){
        // No arrival date set
      }
      else {
        var days_until = ivisa.calculate_days_until(arrival_date);
        if(days_until !== false && days_until > parseInt(do_info['disable_arrival_more_than'])){
          enabled = false;
        }
      }
    }
    
    return enabled;
  }
  
  
  this.update_embassy_registration_options = function(){
    $('#ivisa-embassy-addons').hide();
    var $div = $('#ivisa-embassy-addon-list');
    $div.html('');
    var count = 0;
    $.each(ivisa.get_embassy_registration_countries(), function(code, qty){
      count++;
      var price = ivisa.app_config.pricing.embassy_registration_fees[code];
      var $inp =  $('<div><input type="checkbox" data-ivisa-name="embassy_reg_'+code+'" data-ivisa-price="'+price+'" data-qty="'+qty+'" /> '+ivisa.__('Register all')+' ' + code +' '+ivisa.__('travelers with the')+' '+code+' '+ivisa.__('Embassy')+' (Add  <span data-ivisa-convert-currency="'+price+'"></span>/person)</div>');
      $inp.find('input').change(function(){ 
        ivisa.update_price();
        var checked = $(this).is(':checked');
        var embassy_country = ivisa.app_config.country_codes[code].toLowerCase().replace(' ','_');
        ivisa.gtm_add_to_cart_if({ 'name': 'embassy_reg', 'category': 'visa', 'brand': embassy_country, 'quantity':checked? 1 : -1 }, { 'quantity==' : checked? 0 : 1 });
      })
      $div.append($inp)
    })
    
    if(count > 0)
      $('#ivisa-embassy-addons').show();
  }
  
  this.get_embassy_registration_countries = function(){
    // Return embassy countries crossed with traveler nationalities
    var countries = {}; 
    
    $.each(ivisa.get_traveler_list(), function(j, trav){
      var nationality = trav.nationality_country;
      if(nationality === undefined || nationality === null || nationality.length === 0)
        return;
      
      if($.inArray(nationality, ivisa.app_config.embassy_registration_countries) !== -1){
        if(countries[nationality] === undefined) {
          countries[nationality] = 0;
        }
        countries[nationality]++;
      }
    });
    return countries;
  }
  
  this.handle_payment = function(mop, amount, currency){
    ivisa.show_form_submit_spinner();
    
    ivisa.log("MOP: " + mop)
    if(mop == 'cc'){
      var $form = $('.ivisa-review-and-pay');
      
      if(!ivisa.validate_card_number($form.find('[data-ivisa-secure="number"]').val()))
        return ivisa.show_error_message("Your card number does not appear to be correct. Please check for typos");
      else if(!ivisa.validate_cvv($form.find('[data-ivisa-secure="cvc"]').val()))
        return ivisa.show_error_message("Please enter a valid CVC");
      
      var card = {
          "kind": "credit_card",
          "full_name": $form.find('[data-ivisa-secure="name"]').val(),
          "number": $form.find('[data-ivisa-secure="number"]').val(),
          "verification_value": $form.find('[data-ivisa-secure="cvc"]').val(),
          "month": $form.find('[data-ivisa-secure="exp_month"]').val(),
          "year": $form.find('[data-ivisa-secure="exp_year"]').val(),
          "email": $('[data-ivisa-name="email"]').val()
      };
      
      ivisa.spreedly_save_card(card);
    }
  }
  
  this.spreedly_save_card = function(card){
    var url = "https://core.spreedly.com/v1/payment_methods.js?environment_key=" + ivisa.app_config.spreedly_publishable + "&" + $.param(card);
    
    ivisa.payment_info = null;
    $.ajax({
      type: "GET",
      url: url,
      dataType: "jsonp"
    }).success(function(data) {
      if (data.status === 201) {
        var card_obj = data.transaction.payment_method;
        ivisa.payment_info = { 'mop':'cc', 'card_token':card_obj.token, 'card_type': card_obj.card_type };
        ivisa.submit_ivisa_order('submit')
      } else {
        ivisa.show_error_message("Validation error: " + data.errors[0].message)
      }
    }).error(function(request, status, error) {
      ivisa.log(error);
      ivisa.show_error_message(error);
    });
  }
  
  this.validate_card_number = function(a){
    return a = (a + "").replace(/\s+|-/g, ""), a.length >= 10 && a.length <= 16 && ivisa.luhn_check(a)
  }
          
  this.luhn_check = function(a){
    var b, c, d, e, f, g;
    for (d = !0, e = 0, c = (a + "").split("").reverse(), f = 0, g = c.length; g > f; f++) b = c[f], b = parseInt(b, 10), (d = !d) && (b *= 2), b > 9 && (b -= 9), e += b;
    return e % 10 === 0
  }

  this.validate_cvv = function(a){
    return /^\d+$/.test(a);
  }
  
  this.dataLayerPush = function(arr){
    if(typeof window.dataLayer == 'undefined')
      window.dataLayer = [];
    
    window.dataLayer.push(arr); 
    ivisa.log('dataLayer.push'); 
    ivisa.log(arr); 
  }
  
  this.gtrack = function(action, label, category){
    window.dataLayer = window.dataLayer || []; 
    
    if(category == null || category.length ==0)
      category = 'interaction'
    if(label == null || label.length ==0)
      label = ''
    
    var ev = {'category':category,
              'action'  :action,
              'label'   :label,
              'event'   :'eventga'
             };
    
    dataLayer.push(ev);
    
    ivisa.log('GA Event: ' + category +' > ' + action + ' > ' + label);
    return true;
  }
  
  // Used for Google Analytics Add/Remove from Cart
  this.gtm_traveler_nationalities_changed = function(){
    var list = [];
    
    $.each(ivisa.get_traveler_nationalities(), function(i, cc){
      var found = false;
      $.each(list, function(j, nationality) {
        if(nationality.code == cc){
          list[j].qty += 1;
          found = true;
        }
      })
      
      if(!found)
        list.push({"code":cc, "qty":1})
    });
    
    var current = ivisa.get_list_groupings(list, 'code')
    var cart = ivisa.get_list_groupings(ivisa.gtm_products_in_cart || [], 'variant', 'name','visa')
    
    // Note: Cart should contain max of 1 visa per variant (with the quantity field set)
    // Remove anything from the cart that's missing or has an INCORRECT QUANTITY
    for(var key in cart){
      if(!cart.hasOwnProperty(key))
        continue;
      if(!current.hasOwnProperty(key)){
        delete cart[key];
        ivisa.gtm_remove_from_cart_by_product_info({'name':'visa', 'variant': key })
      } 
      else if (current[key] != cart[key]){ // Handles additions AND subtractions
        ivisa.gtm_add_to_cart({ 'name': 'visa', 'variant': key, 'quantity': (current[key] - cart[key]) } );
      }
    }
    
    // Add anything new to the cart
    for(var key in current){
      if(!current.hasOwnProperty(key))
        continue;
      if(!cart.hasOwnProperty(key))
        ivisa.gtm_add_to_cart({ 'name': 'visa', 'category': 'visa', 'brand': $('[name="country"]').val(), 'variant': key, 'quantity': current[key] });
    }
  }
  
  this.gtm_record_product_view = function(product){
    ivisa.dataLayerPush({
      'ecommerce': {
        'detail': { 'products': [ product ] }
       }
    });
  }

  this.gtm_add_to_cart_if = function(product, conditions){
    var cart_index = ivisa.gtm_find_cart_product_by_info(product);
    
    if(typeof conditions['quantity=='] != 'undefined'){
      if(conditions['quantity=='] === 0 && cart_index === false)
        ivisa.gtm_add_to_cart(product);
      else if(cart_index !== false && conditions['quantity=='] === ivisa.gtm_products_in_cart[cart_index]['quantity'])
        ivisa.gtm_add_to_cart(product)
    }
  }

  this.gtm_add_to_cart = function(product){
    ivisa.gtm_products_in_cart = ivisa.gtm_products_in_cart || [];
    
    var add_qty = (typeof product['quantity'] == 'undefined')? 1 : parseInt(product['quantity']);
    
    var cart_index = ivisa.gtm_find_cart_product_by_info(product);
    if(cart_index !== false)
      product = jQuery.extend({}, ivisa.gtm_products_in_cart[cart_index]);
    
    product['quantity'] = Math.abs(add_qty);
    
    var event = {
      'event': (add_qty > 0? 'add_to_cart':'remove_from_cart'),
      'userCurrencyCode': ivisa.currency,
      'ecommerce': {  }
    };
    
    event['ecommerce'][add_qty>0? 'add':'remove'] = { 'products': [ product ] };
    
    ivisa.dataLayerPush(event);
    
    var cart_index = ivisa.gtm_find_cart_product_by_info(product);
    if(cart_index !== false){
      // Product is already in the cart!
      var cart_product = ivisa.gtm_products_in_cart[cart_index];
      var cart_qty = (typeof cart_product['quantity'] == 'undefined')? 1 : parseInt(cart_product['quantity']);
      var new_qty = cart_qty + add_qty;
      if(new_qty < 1){
        ivisa.gtm_products_in_cart.splice(cart_index, 1); // DELETE from cart
        return true;
      }
      ivisa.gtm_products_in_cart[cart_index]['quantity'] = new_qty;
      return cart_index;
    }
    else if (add_qty > 0) {
      ivisa.gtm_products_in_cart.push(product)
      return (ivisa.gtm_products_in_cart.length - 1);
    }
  }

  this.gtm_find_cart_product_by_info = function(product){
    ivisa.gtm_products_in_cart = ivisa.gtm_products_in_cart || [];
    
    for(var cart_index=0; cart_index < ivisa.gtm_products_in_cart.length; cart_index++){
      var match = true;
      for(var key in product){
        if(!product.hasOwnProperty(key) || key == 'quantity')
          continue;
        if(!ivisa.gtm_products_in_cart[cart_index].hasOwnProperty(key) || product[key] != ivisa.gtm_products_in_cart[cart_index][key])
          match = false
      }
      
      if(match)
        return cart_index;
    }
    
    return false;
  }

  // Remove ALL quantity from the cart
  this.gtm_remove_from_cart_by_product_info = function(product){
    var cart_index = ivisa.gtm_find_cart_product_by_info(product);
    if(cart_index !== false){
      var prod = jQuery.extend({}, ivisa.gtm_products_in_cart[cart_index]);
      prod['quantity'] = -1 * prod['quantity']
      ivisa.gtm_add_to_cart(prod);
    }
  }

  this.gtm_record_checkout_page = function(){
    ivisa.gtm_products_in_cart = ivisa.gtm_products_in_cart || [];
    
    var event = {
        'event': 'checkout',
        'userCurrencyCode': ivisa.currency,
        'ecommerce': {
          'checkout': { 'products': ivisa.gtm_products_in_cart }
        }
    };
    
    if(ivisa.app_config.order_type == 'visa')
      event['daysInAdvance'] = ivisa.calculate_days_until(ivisa.get_input_value($('[data-ivisa-name="arrival_date"]')));
    
    ivisa.dataLayerPush(event);
  }
  
  this.visa_price_calculator_dirty = function(){
    $('#visa-price-calc-price-wrapper').hide()
    $('#visa-price-calc-btn').show()

    // Reload the Visa Types dropdown
    var types_visible = 0;
    var nationality = $('select[data-field="visa-calc-nationality"] option:selected').val();
    $('select[data-field="visa-calc-visa-type"] option').each(function(){
       var vt = $(this).val();
       if(window.ivisa_api_output['visa_types'][vt] !== undefined && window.ivisa_api_output.app_config.supported_nationalities.hasOwnProperty(nationality)){
         var visa_type = window.ivisa_api_output['visa_types'][vt];
         if(visa_type['nationalities'] !== undefined && visa_type.nationalities.length > 0){
           if($.inArray(nationality, visa_type.nationalities) === -1)
             $(this).hide();
           else {
             $(this).show()
             types_visible++;
           }
         }
         else {
           $(this).show()
           types_visible++;
         }
       }
    })

    var $type_dropdown =  $('select[data-field="visa-calc-visa-type"]')
    $type_dropdown.show()
    if($('select[data-field="visa-calc-visa-type"] option:selected').css('display') == 'none')
      $type_dropdown.val('')

    $type_dropdown.next().hide();
    if(nationality === '' || types_visible === 0){
      $type_dropdown.hide()
      if(nationality !== '')
        $type_dropdown.next().show().html(ivisa.__('Nationality not supported'));
    }
    ivisa.visa_price_calculator_modal_compute();
  }

  this.visa_price_calculator_modal_compute = function(){
    $('#visa-price-calc-btn').hide();
    
    var good = true;
    var d = {'country':ivisa.destination_country(), 'qty' : $('[data-field="visa-calc-qty"]').val(), 'nationality': $('select[data-field="visa-calc-nationality"] option:selected').val(), 'visa_type': $('select[data-field="visa-calc-visa-type"] option:selected').val(), 'currency': ivisa.currency, 'is_rush': 0 };
    $.each(d, function(i, fval){
      if(fval == null || fval.length === 0)
        good = false;
    })
    if(!good)
      return;
    
    var wrapper = $('#visa-price-calc-price-wrapper').show();
    wrapper.html('<span class="glyphicon glyphicon-refresh"></span>');
    
    $.ajax({ type:'post', url: ivisa.api_domain + ivisa.visa_calculator_endpoint, data:d }).done(function(data){
      if(typeof data.error_msg == 'string'){
        wrapper.html('<div style="font-size:14px; line-height:16px; color:red">' + data.error_msg  + '</div>');
      }
      else {
        wrapper.html(data.price)
        $('#visa-price-calc-apply').attr('href', data.apply_url)
      }
    });
  }

  
  this.get_list_groupings = function(arr, extract_key, required_key, required_val){
    var groups = {};
    
    $.each(arr, function(i, val){
      var add_to_count = 1;
      if(typeof val === 'object'){
        if(required_key != null && (typeof val[required_key] == 'undefined' || val[required_key] != required_val))
          return;
        if(typeof val[extract_key] === 'undefined')
          return;
        if(typeof val['quantity'] != 'undefined')
          add_to_count = parseInt(val['quantity']);
        else if (typeof val['qty'] != 'undefined')
          add_to_count = parseInt(val['qty']);
        val = val[extract_key]
      }
    
      if(!groups.hasOwnProperty(val))
        groups[val] = 0;
      groups[val] += add_to_count;
    })
    
    return groups;
  }
  
  this.open_multipart_application = function(trav_num, section_num){
    if(section_num == null)
      section_num = 1;
    
    var $wrapper = $('#ivisa-applicant-fields-num-' + trav_num);
    $wrapper.find('.ivisa-multipart-section').hide();
    $wrapper.find('.ivisa-hide-when-application-open').hide()
    $wrapper.find('.ivisa-show-when-application-open').show();
    
    $wrapper.find('[data-ivisa-section-num="'+section_num+'"]').show();
    
    $wrapper.find('.ivisa-current-section-num').html(section_num)
    $wrapper.find('.ivisa-total-sections-num').html(ivisa.multipart_number_of_sections())
  }
  
  this.close_multipart_application = function(trav_num){
    var $wrapper = $('#ivisa-applicant-fields-num-' + trav_num);
    $wrapper.find('.ivisa-multipart-section').hide();
    $wrapper.find('.ivisa-hide-when-application-open').show()
    $wrapper.find('.ivisa-show-when-application-open').hide();
  }
  
  this.multipart_number_of_sections = function(){
    var $wrapper = $('#ivisa-applicant-fields-num-0');
    return $wrapper.find('.ivisa-multipart-section:last').attr('data-ivisa-section-num');
  }
  
  this.multipart_current_section_num = function(trav_num){
    var $wrapper = $('#ivisa-applicant-fields-num-' + trav_num);
    var step = parseInt($wrapper.find('.ivisa-current-section-num').html())
    return step == ''? 0 : step;
      
  }
  
  this.multipart_update_step_widget = function(){
    // Updates for all travelers. If all travelers are complete, show Finalize/Submit button
    var num_complete = 0;
    var num_travelers = ivisa.get_traveler_list().length;
    for(var i=0; i < num_travelers; i++){
      if(ivisa.multipart_update_step_widget_for_traveler(i))
        num_complete++;
    }
    
    if(num_complete === num_travelers){
      $('.ivisa-submit-completed-application-btn').show();
      $('.ivisa-hide-when-application-complete').hide();
    }
    else {
      $('.ivisa-submit-completed-application-btn').hide();
      $('.ivisa-hide-when-application-complete').show();
    }
  }
  
  this.multipart_update_step_widget_for_traveler = function(trav_num){
    var $wrapper = $('#ivisa-applicant-fields-num-' + trav_num);
    $wrapper.find('.ivisa-step-indicator').removeClass('current done ivisa-clickable').unbind('click');
    $wrapper.find('[data-ivisa-step-num="'+ivisa.multipart_current_section_num(trav_num)+'"]').addClass('current')
    
    var sections = []; // hack to deal with JS function scoping
    for(x=1; x <= ivisa.multipart_number_of_sections(); x++){ sections.push(x) };
    var num_complete = 0;
    var found_incomplete = false;
    $.each(sections, function(i, section_num){
      var is_complete = ivisa.multipart_is_section_complete(trav_num, section_num);
      var $btn = $wrapper.find('[data-ivisa-step-num="'+section_num+'"]');
      if(is_complete){
        num_complete++;
        $btn.addClass('done')
      }
      if(is_complete || !found_incomplete){
        if(!is_complete)
          found_incomplete = true;
        $btn.addClass('ivisa-clickable')
        $btn.bind('click', function(){ ivisa.open_multipart_application(trav_num, section_num)})
      }
    });
    
    if(num_complete == sections.length){
      // All sections are complete for this traveler
      return true;
    }
    
    return false; // something is incomplete
  }
  
  this.multipart_is_section_complete = function(trav_num, section_num){
    var $wrapper = $('#ivisa-applicant-fields-num-' + trav_num + ' [data-ivisa-section-num="'+section_num+'"]');
    var missing_required_fields = ivisa.get_missing_fields($wrapper, false);
    if(missing_required_fields.length == 0)
      return true;
    else
      return false;
  }
  
  this.multipart_save_successful = function(resp, data){
    // After saving updates to an existing order
    var trav_num = data.update_trav_num;
    var $wrapper = $('#ivisa-applicant-fields-num-' + trav_num);
    var $msg = $wrapper.find('.ivisa_submit_success_message');

    ivisa.multipart_update_step_widget();
    
    $msg.html(ivisa.__("Saved") + '.').show();
    setTimeout(function(){ $msg.hide() }, 4000)
    
    if(typeof data['advance_to_next_section'] != 'undefined' && data.advance_to_next_section ==true){
      var total_sections = ivisa.multipart_number_of_sections()
      var cur = ivisa.multipart_current_section_num(trav_num)
      if(cur < total_sections)
        ivisa.open_multipart_application(trav_num, cur + 1)
      else
        ivisa.close_multipart_application(trav_num)
    }
  }
  
  this.save_multipart_form = function(trav_num){
    ivisa.submit_ivisa_order('update_existing_visa_application', false, { 'update_trav_num': trav_num });
  }
  
  this.multipart_next_section = function(trav_num){
    $wrapper = $('#ivisa-applicant-fields-num-' + trav_num + ' [data-ivisa-section-num="'+ivisa.multipart_current_section_num(trav_num)+'"]');
    if(ivisa.validate_responses($wrapper, true) !== true)
      return;
    
    ivisa.submit_ivisa_order('update_existing_visa_application', false,  { 'update_trav_num': trav_num, 'advance_to_next_section':true });
  }
  
  this.fake_data = function(){
    $(document).find('input, select, textarea').each(function(){
      if(!ivisa.is_field_visible($(this)))
        return; // hidden input
      
      if(typeof $(this).attr('data-ivisa-secure') == "string" && $(this).attr('data-ivisa-secure').length > 0){}
      else if($(this).attr('data-ivisa-name') == 'email')
        $(this).val('test' +'@' + 'ivisa' + '.com')
      else if($(this).is('input') && $(this).attr('type') != 'hidden'){
        if($(this).hasClass('ivisa-input-datepicker')){
          var today = new Date();
          var month = today.getMonth()+1;
          today = today.getFullYear() + '-' + (month<=9?'0':'')+ month + '-' + (today.getDate()<=9?'0':'') +today.getDate();
          if($(this).attr('data-ivisa-name') == 'dob')
            $(this).val(ivisa.add_days(today, Math.floor(Math.random()*-3000) - 250));
          else
            $(this).val(ivisa.add_days(today, Math.floor(Math.random()*200) * ($(this).attr('data-ivisa-max-date')==today? -1:1)));
        } 
        else if($(this).attr('type') == 'radio' || $(this).attr('type') == 'file'){}
        else
          $(this).val('yo')
      }
      else if($(this).is('select')){
        $(this).val($(this).find('option:nth(2)').val())
      }
      $(this).change()
    });
  }
  
};

