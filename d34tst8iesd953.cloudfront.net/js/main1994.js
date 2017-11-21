// main.js

function cs(){
  alert("Coming soon!");
  return false;
}

function __(word){
  // Translations
  if(typeof window.word_translations != 'undefined' && typeof window.word_translations[word.toLowerCase()] == 'string')
    return window.word_translations[word.toLowerCase()];
  return word;
}

function has_cookies_enabled(show_alert){
  set_cookie('cookies', '1');
  if(!cookie_isset('cookies')){
    var msg = __('Error: Browser Cookies are REQUIRED but you have disabled them. Please enable cookies in your browser settings.')
    if(show_alert === true)
      alert(msg)
    return msg;
  }
  else
    return true;
}

// Accepts mm/dd/yyyy only
function add_days(date_str, days){
  var chunks = date_str.split('/');
  
  var d = new Date(chunks[2], parseInt(chunks[0])-1, parseInt(chunks[1]), 0,0,0,0);
  
  d.setTime(d.getTime() + days * 86400000 );
  var month = (d.getMonth()+1);
  
  return (month<=9?'0':'') + month + '/' + (d.getDate()<=9?'0':'') + d.getDate() + '/' + d.getFullYear();
}

// Accepts mm/dd/yyyy only
function format_date(date_str){
  var chunks = date_str.split('/');
  var month = parseInt(chunks[0]) -1;
  var names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  if(typeof window.month_names != 'undefined' && window.month_names[0] != 'January')
    names = window.month_names;
  
  return names[month]+'-'+parseInt(chunks[1])+'-'+chunks[2];
}

function drop_script(url, delay){
  if(!delay)
    delay = 499;
  
  setTimeout(function(){ 
    $.ajax({ url: url, dataType: "script", cache: true });
  }, delay);
}

function drop_tracking_pixel(url, delay, cookie_name, cookie_duration){
  if(!delay)
    delay = 399;
  
  if(cookie_name != null){ 
    if(cookie_isset(cookie_name))
      return;
    else
      set_cookie(cookie_name, '1', 1);
  }
  
  setTimeout(function(){ 
    $('body').append('<img src="' + url + '" width="1" height="1" border="0" style="display:none">');
  }, delay);
}

function gtrack(action, label, category){
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
  
  console.log('GA Event: ' + category +' > ' + action + ' > ' + label);
  return true;
}

function gtrack_social(network, url){
  window.dataLayer = window.dataLayer || []; 
  
  dataLayer.push({'event': 'socialInt','socialNetwork': network, 'socialAction': 'visit', 'socialTarget': url });
  console.log('GA Event: SocialInteraction > ' + network)
}

function delete_cookie(cookie_name){
  set_cookie(cookie_name, '', -1000);
}

function cookie_isset(cookie_name){
  return (document.cookie.indexOf(cookie_name + '=') == -1)? false : true;
}

function get_cookie(cookie_name){
  var start = document.cookie.indexOf(cookie_name + '=');
  
  if(start == -1)
    return null;
  else {
    var end = document.cookie.indexOf(";", start);
    end = (end == -1)? document.cookie.length : end;
    return document.cookie.substring(start + cookie_name.length + 1, end);
  }
}

function set_cookie(name, value, expires_hours){
  var expires = ""; // session cookie
  if(expires_hours) {
    var date = new Date();
    date.setTime(date.getTime() + Math.round(expires_hours *60*60*1000));
    var expires = "; expires="+date.toUTCString();
  }
  
  document.cookie = name + "=" + value + expires + "; path=/";
}

function select_element_cursor(el) {
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

function bootstrap_popover_placement(context, source) {
  var position = $(source).offset();
  var space_on_right = window.innerWidth - position.left; 
  var space_on_bottom = window.innerHeight - (position.top - $('body').scrollTop());
  var space_on_top = window.innerHeight - space_on_bottom;
  
  if(space_on_right > 515)
    return "right";
  
  if(space_on_bottom > space_on_top)
    return "bottom";
  
  return "top";
};

function visa_price_calculator_dirty(){
  $('#visa-price-calc-price-wrapper').hide()
  $('#visa-price-calc-btn').show()
  visa_price_calculator_modal_compute();
}

function visa_price_calculator_modal_compute(){
  $('#visa-price-calc-btn').hide();
  
  var currency = $('[data-field="visa-calc-currency"]').val()
  if(currency == null || currency.length == 0)
    currency = $('#currency').val()
    
  var good = true;
  var d = {'country':$('[data-field="visa-calc-country"]').val(), 'qty' : $('[data-field="visa-calc-qty"]').val(), 'nationality': $('select[data-field="visa-calc-nationality"] option:selected').val(), 'currency': currency, 'is_rush': $('select[data-field="visa-calc-is-rush"] option:selected').val() };
  $.each(d, function(i, fval){
    if(fval == null || fval.length === 0)
      good = false;
  })
  if(!good)
    return;
  
  var wrapper = $('#visa-price-calc-price-wrapper').show();
  wrapper.html('<span class="glyphicon glyphicon-refresh"></span>');
  
  $.ajax({ type:'post', url:'/visa' + '/' + 'estimate_visa_price', data:d }).done(function(data){
    if(typeof data.error_msg == 'string'){
      wrapper.html('<div style="font-size:14px; line-height:16px; color:red">' + data.error_msg  + '</div>');
    }
    else {
      wrapper.html(data.price)
      $('#visa-price-calc-apply').attr('href', data.apply_url)
    }
  });
}


/** 
 * Takes a single optional function as an argument. When visa requirements are updated
 * and this argument is set, it will be called with the passed returned html, textStatus, and jqXHR object.
 */
function initialize_visa_requirements_widget(requirements_updated_closure){
  $("[name='from_country'], [name='to_country']").bind('change',function(){
    $('.visareq, #visa_required_indicator, #visa_not_required_indicator').hide();
    var $to = $("[name='to_country']").find("option:selected");
    var from_cc = $("[name='from_country']").find("option:selected").attr('data-country');
    var to_cc = $to.attr('data-country');
    
    $('#to-country-name').html($to.attr('data-country-name-pretty'))
    var flag_url = $to.attr('data-flag-url');
    $('#to-country-flag').attr('src', flag_url).css('visibility',flag_url==''? 'hidden':'visible');

    $('#visa-result-section').html('');
    if(to_cc.length !=2 || from_cc.length !=2) {
      // If we don't have two valid values, short circuit this method
      // and let our closure know we don't have valid inputs.
      if (requirements_updated_closure !== undefined) {
        requirements_updated_closure(null, null, null, false); 
      }
      return;
    }

    $('#visa-result-section').html('<img src="/img/loading.gif" style="height:50px" />').show();
    $.ajax({url: $('[name="visa_requirements_url"]').val(), data: {'to':to_cc, 'from':from_cc} }).done(function(html, text_status, jqXHR){
      $('#visa-result-section').html(html)
      var visa_req = $('tr.to_' + to_cc + '.from_' + from_cc).attr('data-is-visa-required');
      
      if(!visa_req || visa_req.length == 0){}
      else if(visa_req === "0")
        $('#visa_not_required_indicator').show();
      else if(visa_req === "1")
        $('#visa_required_indicator').show();
      
      if (requirements_updated_closure !== undefined) {
        requirements_updated_closure(html, text_status, jqXHR, true);
      }
    })
    
  }).change();
}


function redirect_to_application(){
  var from_cc = $("[name='from_country']").find("option:selected").attr('data-country');
  var url = $("[name='to_country']").find("option:selected").attr('data-url');

  window.location.href = url + '?nationality=' + from_cc
}

function update_visa_cost(country){
  var nationality = $("#why_us_currency option:selected").val()

  var d = {'country': country, 'qty' : 1, 'nationality': nationality, 'visa_type': $('#visa_types option:selected').val(), 'currency': 'USD', 'is_rush': 0 };
    
  $('.visa-cost').html('<span class="glyphicon glyphicon-refresh"></span>');
  $('.service-fee').html('<span class="glyphicon glyphicon-refresh"></span>');
  
  $.ajax({ type:'post', url:'/visa' + '/' + 'estimate_visa_price', data:d }).done(function(data){
    if(data.error_msg !== undefined){
      $('.visa-cost').html('N/A')
      $('.service-fee').html('N/A')
      $('.visa-total-cost').html('N/A')
    }
    else {
      $('.visa-cost').html(data.visa_cost);
      $('.service-fee').html(data.service_fee);
      $('.visa-total-cost').html(data.total_cost);
    }
  });
}


function update_visa_types(country){
  $('#visa_types option').each(function(){
     var vt = $(this).val();
     if(window.visa_types[vt] !== undefined){
       if(window.visa_types[vt]['nationalities'] !== undefined && window.visa_types[vt].nationalities.length > 0){
         if($.inArray($("#why_us_currency option:selected").val(), window.visa_types[vt].nationalities) === -1)
           $(this).hide();
         else
           $(this).show()
       }
     }
  })
  
  if($('#visa_types option:selected').css('display') == 'none')
    $('#visa_types').val('')

  update_visa_cost(country)
}

function post_to_facebook_feed(share_url, share_message, success_callback){
  FB.ui({
    method: 'feed',
    link: share_url, quote: share_message,
    caption: share_message,
  }, function(response){
    if(response !== undefined)
      success_callback();
  });
}

function share_to_facebook_for_discount(order_id, share_url, share_message){
  post_to_facebook_feed(share_url, share_message, function(){
    $('.facebook_discount').html('<img src="/img/country-details-thumbs-up.png" /> Thank You!').unbind().attr('onclick','').css('cursor','auto');
    $.ajax({ url:'/account/facebook_discount/' + order_id });
  })
}

