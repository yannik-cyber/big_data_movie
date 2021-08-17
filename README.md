# Big Data Project

**Einleitung**  

Wir, das sind
- Yannik Hubrich (2249266),
- Philipp Becht (9443009),
- Paula Hölterhoff ,
- Pascal Schmidt (8133405),
- Simon Wrigg (5874903), 

haben im Rahmen der Vorlesungsreihe "Big Data" ein Movie Recommendation System hergestellt, welches dem Anwender nicht nur seine belibtesten Filme anzeigt, sondern auch, welches Genre dem Anwender am meisten gefällt.
Hierfür wurden die in den Vorlesungen kennengelernten Architekturen verwendet. Die Berechnung der beliebtesten Filme wird über Spark realisiert. In einer mysql Datenbank werden alle Filme inklusive einer Beschreibung und eines Bildes gespeichert. Die Web-App wurde in der index.js gebaut.

**************************

**Technische Komponenten**


Um von einem Browser auf den Webserver zu zugreifen, wird Kubernetes (nginx????) als Load Balancer verwendet. Die Webanwendung, in der die Filme und die jeweiligen Filmempfehlungen angezeigt werden, ist eine Node.js App. Diese ist zum einen mit einem Cache Server und zum anderen mit einem Datenbanken Server verbunden. Es werden hierfür zwei Memchached-Server genutzt, in denen die Filmdaten nach einmaligem Aufruf gespeichert werden. Sobald ein Film, der bereits im Cache vorhanden ist, abgefragt wird, muss die Node.js App nicht mehr auf die Datenbank zugreifen. 

Als Datenbank dient eine MySQL Datenbank. In dieser Datenbank sind zwei Tabellen gespeichert. Die Tabelle "Movies" beinhaltet die Filmdaten, die auf der Web-App ausgewählt bzw. dargestellt werden. In der "Popular"-Tabelle werden die vom User favourisierten Filme gespeichert. Ein Film gilt als favourisiert, sobald der Film häufig vom Nutzer ausgewählt wurde. Jeder einzelne Aufruf eines Filmes erhöht dessen Attribut 'count' um eine Einheit. Dieses Attribt stellt die Basis zur Berechnung der Top Movies und der Top Genres dar. Die genaue Berechnung der Favouriten und die Abstufung der Filme finden allerdings in der Spark Applikation statt.

Für das Big Data Messaging wird Kafka verwendet. Die Node App wird durch Kafka.js mit Kafka verbunden. Um die Streamingdaten in der Spark App tatsächlich nutzen zu können, müssen die binären Daten aus Kafka in ein json Format konvertiert werden, sodass sie für die Spark App lesbar sind.
Die Spark App schriebt die Aufrufdaten der Filme in die "Popular"-Tabelle, nachdem ein Batch berechnet wurde. Diese wird somit nach jedem Batch upgedated. Die Node.js App greift regelmäßig auf die popular Tabelle zu und gibt somit stets die beliebtesten Filme und Genres wieder.























***************************


**Hinweise zur Ausführung**


Um das Recommendation System zu starten, ist es zunächst notwendig die auf github abgelegte zip-Datei herunterzuladen und abzuspeichern.
Mithilfe einer shell muss dann zum Ordner hinnavigiert werden, wo das Projekt abgespeichert wurde.

Stellen Sie vorher sicher, dass sie die folgenden Prerequisites ausgeführt haben.
1) minikube start
3) minikube addons enable ingress
4) helm repo add strimzi http://strimzi.io/charts/
5) helm install my-kafka-operator strimzi/strimzi-kafka-operator
6) kubectl apply -f ~/movie_use-case/changed_files/kafka-cluster-def.yaml
7) helm install --namespace=default --set hdfs.dataNode.replicas=1 --set yarn.nodeManager.replicas=1 --set hdfs.webhdfs.enabled=true my-hadoop-cluster stable/hadoop
8) skaffold dev


Bitte beachten Sie, dass Sie die folgenden Proxy-Einstellungen vornehmen müssen:
1) Network Settings, Sock_Proxy erstellen mit IP: 127.0.0.1 und Port 5555
2) Verbinden Sie sich mit diesem SSH: -D5555 yannik@185.102.93.248, PW: BigData_DSB19
3) Geben Sie 192.168.49.2 in Ihrem Browser ein



Mit 'skaffold delete' beenden Sie alle Kubernetes Ressourcen in diesem Projekt.


*************


**Sonstiges**

Bei Rückfragen oder Problemen beim Ausführen unseres Projektes, helfen wir Ihnen gerne weiter!

