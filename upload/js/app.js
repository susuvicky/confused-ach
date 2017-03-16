$(function() {
    var uploader = WebUploader.create({
        pick: {
            id: '#filePicker',
            label: '点击选择图片'
        },
        chunked: true,
        sendAsBinary: true,
        server: 'upload.php',
        fileNumLimit: 300,
        fileSizeLimit: 3000 * 1024 * 1024, // 200 M
        fileSingleSizeLimit: 2000 * 1024 * 1024 // 50 M
    });

    $(".uploadBtn").on('click', function() {
        uploader.options.formData={md5:"1515das1f2dasf1dasf"};
        uploader.upload();
        
    });



    uploader.on('fileQueued', function(file) {
        var md5 = this.md5File(file)

        // 及时显示进度
        .progress(function(percentage) {
            console.log('Percentage:', percentage);
        })

        // 完成
        .then(function(val) {
            console.log('md5 result:', val);
            uploader.on("uploadBeforeSend", function() {
                console.log(arguments)
            })
        });
        console.log(md5)

    });
    uploader.on('error', function(data) {
        console.log(data);
    });
    uploader.on('uploadProgress', function(file, percentage) {
        console.log(percentage);
    });

    WebUploader.Uploader.register({
        "before-send-file": "beforeSendFile", // 整个文件上传前
        "before-send": "beforeSend", // 每个分片上传前
        "after-send-file": "afterSendFile" // 分片上传完毕
    }, {
        beforeSendFile: function(file) {
            var task = new $.Deferred();
            var start = new Date().getTime();

            //拿到上传文件的唯一名称，用于断点续传
            uniqueFileName = md5(file.name + file.size);

            $.ajax({
                type: "POST",
                url: check_url, // 后台url地址
                data: {
                    type: "init",
                    uniqueFileName: uniqueFileName,
                },
                cache: false,
                async: false, // 同步
                timeout: 1000, //todo 超时的话，只能认为该文件不曾上传过
                dataType: "json"
            }).then(function(data, textStatus, jqXHR) {
                if (data.complete) { //若存在，这返回失败给WebUploader，表明该文件不需要上传                
                    task.reject();
                    // 业务逻辑...

                } else {
                    task.resolve();
                }
            }, function(jqXHR, textStatus, errorThrown) { //任何形式的验证失败，都触发重新上传
                task.resolve();
            });

            return $.when(task);
        },
        beforeSend: function(block) {
            //分片验证是否已传过，用于断点续传
            var task = new $.Deferred();
            $.ajax({
                type: "POST",
                url: check_url,
                data: {
                    type: "block",
                    chunk: block.chunk,
                    size: block.end - block.start
                },
                cache: false,
                async: false, // 同步
                timeout: 1000, //todo 超时的话，只能认为该分片未上传过
                dataType: "json"
            }).then(function(data, textStatus, jqXHR) {
                if (data.is_exists) { //若存在，返回失败给WebUploader，表明该分块不需要上传
                    task.reject();
                } else {
                    task.resolve();
                }
            }, function(jqXHR, textStatus, errorThrown) { //任何形式的验证失败，都触发重新上传
                task.resolve();
            });
            return $.when(task);
        },
        afterSendFile: function(file) {
            var chunksTotal = Math.ceil(file.size / chunkSize);
            if (chunksTotal > 1) {
                //合并请求
                var task = new $.Deferred();
                $.ajax({
                    type: "POST",
                    url: check_url,
                    data: {
                        type: "merge",
                        name: file.name,
                        chunks: chunksTotal,
                        size: file.size
                    },
                    cache: false,
                    async: false, // 同步
                    dataType: "json"
                }).then(function(data, textStatus, jqXHR) {
                    // 业务逻辑...

                }, function(jqXHR, textStatus, errorThrown) {
                    current_uploader.uploader.trigger('uploadError');
                    task.reject();
                });
                return $.when(task);
            }
        }
    });

});
