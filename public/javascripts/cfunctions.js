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

  // Event listeners
  $('a[id|="changeDestination"]').click(function(event) {
    event.preventDefault();
    $('#url').attr('value', $(this).attr("href"));
  });

  $('a[id|="manageDestinations"]').click(function(event) {
    event.preventDefault();
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
    $('#newDestinationForm').css('visibility','visible');
    //$("#destinationTableBody").append('<tr>');

    // tbody id : destinationTableBody
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
          alert(error);
        } else {
          $('#newDestinationForm').css('visibility','visible');
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
};

function FillDestinationTable(destinations) {
  for (destination in destinations) {
    $("#destinationTableBody").append(destination.name);
  }
  $('#newDestinationForm').css('visibility','hidden');
  $('#modalDestinationEditor').modal('show');
};

function isBlank(str) {
    return (!str || /^\s*$/.test(str));
};