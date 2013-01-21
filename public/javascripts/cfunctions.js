function ClientFunctions() {
  var socket = io.connect();
  socket.on('connect', function() {
    socket.emit('getConfigurationElementByName', 'xmleditor', function(error, data) {
      if (error) {
        alert('Error on getConfigurationElementByName: ' + error);
      } else {
        var xmlEditorConfig = data;
        xmlEditorConfig.extraKeys = {
          "'>'": function(cm) { cm.closeTag(cm, '>', true); },
          "'/'": function(cm) { cm.closeTag(cm, '/'); }
        };
        var myEditor = CodeMirror.fromTextArea(editor, xmlEditorConfig);
      }
    });
  });

  RefreshDestinations();
  
  $('#modalDestinationEditor').on('hide', function() {
    RefreshDestinations();
  });

  // Event listeners
  $('a[id|="manageDestinations"]').click(function(event) {
    event.preventDefault();
    $('#destinationTableBody').empty();
    socket.emit('getSavedDestinations', function(error, destinations) {
      if (error) {
        alert(error);
      } else {
        FillDestinationTable(destinations);
      }
    });
  });

  $('a[id|="addDestination"]').click(function(event) {
    event.preventDefault();
    $('#newDestinationForm').css('display','inline');
  });

  $('button[id|="destinationSaveButton"]').click(function(event) {
    event.preventDefault();
    var stringsEmpty = (isBlank($('#inDestinationName').val()) || isBlank($('#inDestinationURL').val()));
    if (stringsEmpty) {
      alert('Provide name and URL please.');
    } else {
      var destinationObj = {};
      destinationObj['name'] = $('#inDestinationName').val();
      destinationObj['url'] = $('#inDestinationURL').val();
      socket.emit('sendNewDestination', destinationObj, function(error) {
        if (error) {
          alert('Error on saving destination: ' + error);
        } else {
          $('#newDestinationForm').css('display','none');
          $('#destinationTableBody').empty();
          socket.emit('getSavedDestinations', function(error, destinations) {
            if (error) {
              alert(error);
            } else {
              FillDestinationTable(destinations);
            }
          });
        }
      })
    }
  });


  // functions
  function RefreshDestinations() {
    socket.emit('getSavedDestinations', function(error, destinations) {
      if (error) {
        alert(error);
      } else {
        var htmlStructure = '';
        for (var i in destinations) {
          var destination = destinations[i];
          htmlStructure += '<li><a href="' + destination['url'] + '" id="changeDestination">' + destination['name'] + '</a></li>';
        }
        $('#destinationPlaceholder').html(htmlStructure);

        $('a[id|="changeDestination"]').unbind('click');

        $('a[id|="changeDestination"]').click(function(event) {
          event.preventDefault();
          $('#url').attr('value', $(this).attr("href"));
        });

      }
    });
  }

  function DeleteDestinationByID(id) {
    socket.emit('deleteDestinationByID', id, function(error) {
      if (error) {
        alert(error);
      } else {
        $('#destinationTableBody').fadeOut('fast', function() {
          $('#destinationTableBody').empty();
          socket.emit('getSavedDestinations', function(error, destinations) {
            if (error) {
              alert(error);
            } else {
              FillDestinationTable(destinations);
            }
          }); 
        });       
      }
    });
  }

  function FillDestinationTable(destinations) {
    for (var i in destinations) {
      var destination = destinations[i];
      var name = '<td>' + destination['name'] + '</td>';
      var url = '<td>' + destination['url'] + '</td>';
      var optUse = '<a href="#" id="lnkUseDestination" data-destinationUrl="' + destination['url'] + '" title="Use"><i class="icon-play"></i></a>';
      var optDel = '<a href="#" id="lnkDelDestination" data-destinationID="' + destination['_id'] + '" title="Delete"><i class="icon-remove"></i></a>';
      var opts = '<td>' + optUse + optDel + '</td>';
      $("#destinationTableBody").append('<tr>' + name + url + opts + '</tr>');
      $('#destinationTableBody').fadeIn('fast');
    }
    // unregister click events
    $('a[id|="lnkUseDestination"]').unbind('click');
    $('a[id|="lnkDelDestination"]').unbind('click');

    // register events for newly created links
    $('a[id|="lnkUseDestination"]').click(function(event) {
      event.preventDefault();
      $('#url').attr('value', $(this).attr("data-destinationUrl"));
      $('#modalDestinationEditor').modal('hide');
    });

    $('a[id|="lnkDelDestination"]').click(function(event) {
      event.preventDefault();
      DeleteDestinationByID($(this).attr("data-destinationID"));
    });

    $('#newDestinationForm').css('display','none');
    $('#modalDestinationEditor').modal('show');
  };
};

function isBlank(str) {
    return (!str || /^\s*$/.test(str));
};