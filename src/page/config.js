module.exports = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Config</title>
</head>
<body>
    <script>
        let host = window.location.origin;
        let url = prompt('Please enter your dashboard URL.', 'https://detalk-dash.netlify.app') || 'https://detalk-dash.netlify.app';
        document.body.innerHTML = '<a href="' + url + '/login.html?url=' + encodeURIComponent(window.location.origin) + '">Go to Dashboard</a>';
    </script>
</body>
</html>`;