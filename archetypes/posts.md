+++
date = '{{ .Date }}'
draft = true
title = '{{ replace .File.ContentBaseName "-" " " | title }}'
aliases = ['/posts/{{ .File.ContentBaseName }}/']
featureimage = ""
+++
