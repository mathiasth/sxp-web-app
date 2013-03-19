function ClientFunctions() {
  
  var socket = io.connect();
  var myEditor = new Object;
  var xmlEditorConfig = new Object;
  
  socket.on('connect', function() {
    socket.emit('getConfigurationElementByName', 'xmleditor', function(error, data) {
      if (error) {
        alert('Error on getConfigurationElementByName: ' + error);
      } else {
        xmlEditorConfig = data;
        xmlEditorConfig.extraKeys = {
          "'>'": function(cm) { cm.closeTag(cm, '>', true); },
          "'/'": function(cm) { cm.closeTag(cm, '/'); }
        };
        
        // create man editor
        myEditor = CodeMirror.fromTextArea(editor, xmlEditorConfig);

        xmlEditorConfig.autofocus = false;

        // create response editor
        responseEditor = CodeMirror.fromTextArea(log, xmlEditorConfig);
      }
    });
  });

  socket.on('setResponseTextfield', function(content) {
    responseEditor.setValue(content);
    CodeMirror.commands["selectAll"](responseEditor);
    var range = { from: responseEditor.getCursor(true), to: responseEditor.getCursor(false) }
    responseEditor.autoFormatRange(range.from, range.to);
  });

  RefreshServerData();
  
  $('#modalDestinationEditor').on('hide', function() {
    RefreshServerData();
  });

  $('#modalTemplatesEditor').on('hide', function() {
    RefreshServerData();
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

  $('a[id|="manageTemplates"]').click(function(event) {
    event.preventDefault();
    $('#templatesTableBody').empty();
    socket.emit('getSavedTemplateNames', function(error, templateNames) {
      if (error) {
        alert(error);
      } else {
        FillTemplatesTable(templateNames);
      }
    });
  });

  $('a[id|="saveTemplateButton"]').click(function(event) {
    event.preventDefault();
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
          $('#inDestinationName').attr('value', '');
          $('#inDestinationURL').attr('value', '');
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

  $('button[id|="sendMessagesButtonMulti"]').click(function(event) {
    event.preventDefault();
    // disable button to indicate busy state
    $('button[id|="sendMessagesButtonMulti"]').addClass('disabled');
    $('button[id|="sendMessageButtonSingle"]').addClass('disabled');
    var options = {};
    options['url'] = $('#url').attr('value');
    options['count'] = $('#reqCount').attr('value');
    options['parallelism'] = $('#parallelism').attr('value');
    options['messageBody'] = myEditor.getValue();
    socket.emit('sendMultiMessages', options, function(error) {
      if (error) {
        alert('Error when initiating message sending: ' + error);
      } else {
        // re-enable button on function return
        $('button[id|="sendMessagesButtonMulti"]').removeClass('disabled');
        $('button[id|="sendMessageButtonSingle"]').removeClass('disabled');
      }
    });
  });

  $('button[id|="sendMessageButtonSingle"]').click(function(event) {
    event.preventDefault();
    // disable button to indicate busy state
    $('button[id|="sendMessageButtonSingle"]').addClass('disabled');
    $('button[id|="sendMessagesButtonMulti"]').addClass('disabled');
    var options = {};
    options['url'] = $('#url').attr('value');
    options['messageBody'] = myEditor.getValue();
    socket.emit('sendSingleMessage', options, function(error) {
      if (error) {
        alert('Error when transmitting message: ' + error);
        $('button[id|="sendMessagesButtonMulti"]').removeClass('disabled');
        $('button[id|="sendMessageButtonSingle"]').removeClass('disabled');
      } else {
        // re-enable button on function return
        $('button[id|="sendMessagesButtonMulti"]').removeClass('disabled');
        $('button[id|="sendMessageButtonSingle"]').removeClass('disabled');
      }
    });
  });

  $('button[id|="saveCurrentDocAsTemplate"]').click(function(event) {
    event.preventDefault();
    $('button[id|="saveCurrentDocAsTemplate"]').addClass('disabled');
    if (isBlank($('#templateNewName').val())) {
      alert('The template name must not be empty.');
    } else {
      var message = new Object;
      message = {
        name: $('#templateNewName').val(),
        content: myEditor.getValue()
      };
      socket.emit('saveDocAsTemplate', message, function(error) {
        if (error) {
          alert('Error when saving the current document to a template:' + error);
        } else {
          $('button[id|="saveCurrentDocAsTemplate"]').removeClass('disabled');
          socket.emit('getSavedTemplateNames', function(error, templateNames) {
            if (error) {
              alert('Error when getting template names: ' + error);
            } else {
              $('#templatesTableBody').empty();
              FillTemplatesTable(templateNames);
            }
          });
        }
      });
    }
  });

  $('a[id|="lnkHintsModal"]').click(function(event) {
    event.preventDefault();
    $('#hintsModal').modal('show');
  });

  // functions
  function RefreshServerData() {
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
    socket.emit('getSavedTemplateNames', function(error, templateNames) {
      if (error) {
        alert(error);
      } else {
        var htmlStructure = '';
        for (var i in templateNames) {
          var template = templateNames[i];
          htmlStructure += '<li><a href="#" id="changeEditorContent">' + template + '</a></li>';
        }
        $('#templatesPlaceholder').html(htmlStructure);
        $('a[id|="changeEditorContent"]').unbind('click');
        $('a[id|="changeEditorContent"]').click(function(event) {
          event.preventDefault();
          socket.emit('getMessageTemplateByName', $(this).text(), function(error, message) {
            if (error) {
              alert('Error on getting message by templateName: ' + error);
            } else {
              myEditor.setValue(message);
            }
          });
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

  function DeleteTemplateByName(templateName) {
    socket.emit('deleteTemplateByName', templateName, function(error) {
      if (error) {
        alert(error);
      } else {
        $('#templatesTableBody').fadeOut('fast', function() {
          $('#templatesTableBody').empty();
          socket.emit('getSavedTemplateNames', function(error, templateNames) {
            if (error) {
              alert('Error when getting template names: ' + error);
            } else {
              FillTemplatesTable(templateNames);
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
      $('#destinationTableBody').append('<tr>' + name + url + opts + '</tr>');
    }
    $('#destinationTableBody').fadeIn('fast');
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

  function FillTemplatesTable(templateNames) {
    for (var i in templateNames) {
      var templateName = templateNames[i];
      var name = '<td>' + templateName + '</td>';
      var optUse = '<a href="#" id="lnkUseTemplate" data-templateName="' + templateName + '" title="Use"><i class="icon-play"></i></a>';
      var optDel = '<a href="#" id="lnkDelTemplate" data-templateName="' + templateName + '" title="Delete"><i class="icon-remove"></i></a>';
      var opts = '<td>' + optUse + optDel + '</td>';
      $('#templatesTableBody').append('<tr>' + name + opts + '</tr>');
    }
    $('#templatesTableBody').fadeIn('fast');
    
    // unregister click events
    $('a[id|="lnkUseTemplate"]').unbind('click');
    $('a[id|="lnkDelTemplate"]').unbind('click');

    // register events for newly created links
    $('a[id|="lnkUseTemplate"]').click(function(event) {
      event.preventDefault();
      socket.emit('getMessageTemplateByName', $(this).attr("data-templateName"), function(error, message) {
        if (error) {
          alert('Error on getting message by templateName: ' + error);
        } else {
          myEditor.setValue(message);
          $('#modalTemplatesEditor').modal('hide');
        }
      });
    });

    $('a[id|="lnkDelTemplate"]').click(function(event) {
      event.preventDefault();
      DeleteTemplateByName($(this).attr("data-templateName"));
    });    

    $('#modalTemplatesEditor').modal('show');
  }
};

function isBlank(str) {
    return (!str || /^\s*$/.test(str));
};