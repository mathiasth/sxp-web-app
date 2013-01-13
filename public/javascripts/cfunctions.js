
function ClientFunctions() {
  $('a[id|="changeDestination"]').click(function(event) {
    event.preventDefault();
    $('#url').attr('value', $(this).attr("href"));
  });
};
