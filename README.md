# Big Data Project - Movie Recommendation System

**Einleitung**  

Wir, das sind
- Yannik Hubrich (2249266),
- Philipp Becht (9443009),
- Paula Hölterhoff (9633299),
- Pascal Schmidt (8133405),
- Simon Wrigg (5874903), 

haben im Rahmen der Vorlesungsreihe "Big Data" ein Movie Recommendation System hergestellt, welches dem Anwender nicht nur seine belibtesten Filme anzeigt, sondern auch welches Genre dem Anwender am meisten gefällt. Basierend auf den Top Genres kann der Anwender dann Filme ansehen, welche zu dessen Lieblingsgenre gehören. Somit werden die vom Anwender generierten Daten genutzt, um das Produkt selbst zu verbessern.  

Hierfür wurden die in den Vorlesungen kennengelernten Architekturen verwendet. Die Berechnung der beliebtesten Filme wird über Spark realisiert. In einer MySQL Datenbank werden alle Filme inklusive Genre, Originalsprache und eines Bildes gespeichert. Die Web-App wurde in der Datei index.js gebaut. Die Daten werden per Batch abgearbeitet und die Ergebnisse in der Datenbank gespeichert, auf die dann der Webserver zugreift und schließlich die Ergebnisse in der Web-App anzeigt. 

**************************

**Technische Komponenten**

Insgesamt stellt die Gruppe eine Big Data Science Plattform bereit, die die geforderten Bestandteile Web-Server, Cache-Server, Database-Server, Data Lake, Big Data Messaging und Big Data Processing enthält.

Um von einem Browser auf den Webserver zuzugreifen, wird Kubernetes als Load Balancer verwendet. Die Webanwendung, in der die Filme und die jeweiligen Filmempfehlungen angezeigt werden, ist eine Node.js App. Diese ist zum einen mit einem Cache Server und zum anderen mit einem Datenbanken Server verbunden. Es werden hierfür zwei Memchached-Server genutzt, in denen die Filmdaten nach einmaligem Aufruf gespeichert werden. Sobald ein Film, der bereits im Cache vorhanden ist, abgefragt wird, muss die Node.js App nicht mehr auf die Datenbank zugreifen. 

Als Datenbank dient eine MySQL Datenbank. In dieser Datenbank sind zwei Tabellen gespeichert. Die Tabelle "movies" beinhaltet die Filmdaten, die auf der Web-App ausgewählt bzw. dargestellt werden. Die Daten für die einzelnen Filme werden in dieser Datei mit Insert-Befehlen eingelesen. In der "popular"-Tabelle werden die vom User favorisierten Filme gespeichert. Ein Film gilt als favorisiert, sobald der Film häufig vom Nutzer ausgewählt wurde. Jeder einzelne Aufruf eines Filmes erhöht dessen Attribut 'count' in der "popular"-Tabelle um eine Einheit. Dieses Attribut stellt die Basis zur Berechnung der Top Movies und der Top Genres dar. 

Für das Big Data Messaging wird Kafka verwendet. Die Node App wird durch Kafka.js mit Kafka verbunden. Um die Streamingdaten in der Spark App tatsächlich nutzen zu können, müssen die binären Daten aus Kafka konvertiert werden, sodass sie für die Spark App lesbar sind.
Die Spark App schreibt die Aufrufdaten der Filme in die "popular"-Tabelle, nachdem ein Batch berechnet wurde. Diese wird somit nach jedem Batch geupdated. 

Die Node.js App greift regelmäßig auf die "popular"-Tabelle zu und gibt somit stets die beliebtesten Filme und Genres wieder. Generell werden in der index.js zunächst die Verbindungen zu Datenbank, Memcache und Kafka konfiguriert. Hierbei wird zur Vereinfachung auf einen "Optionparser" zurückgegriffen. Die Funktion "executeQuery" stellt die Funktionalität bereit, dass innerhalb der index.js mit Queries auf die Datenbank zugegriffen werden kann. Das Frontend der Web-App basiert auf einem dynamischen HTML-Code, welcher sich jeweils auf den verschiedenen Seiten unterscheidet. Die Bilder sowie Texte sind mithilfe von CSS gestylt.

























***************************


**Hinweise zur Ausführung**


Um das Recommendation System zu starten, ist es zunächst notwendig die auf github abgelegte zip-Datei herunterzuladen und abzuspeichern.
Mithilfe einer shell muss dann zum Ordner hinnavigiert werden, wo das Projekt abgespeichert wurde.

Stellen Sie vorher sicher, dass sie die folgenden Prerequisites ausgeführt haben.
1) minikube start
3) minikube addons enable ingress
4) helm repo add strimzi http://strimzi.io/charts/
5) helm install my-kafka-operator strimzi/strimzi-kafka-operator
6) kubectl apply -f ~/movie_use-case/kafka_cluster/kafka-cluster-def.yaml
7) helm repo add stable https://charts.helm.sh/stable
8) helm install --namespace=default --set hdfs.dataNode.replicas=1 --set yarn.nodeManager.replicas=1 --set hdfs.webhdfs.enabled=true my-hadoop-cluster stable/hadoop
9) skaffold dev





Mit 'skaffold delete' beenden Sie alle Kubernetes Ressourcen in diesem Projekt.


*************


**Sonstiges**

Bei Rückfragen oder Problemen beim Ausführen unseres Projektes, helfen wir Ihnen gerne weiter!
Unsere Gruppe führt die App nicht lokal, sondern über einen Server aus. Sollten Sie dies auch wollen, lassen wir Ihnen gerne die Proxy-Einstellungen zukommen.

