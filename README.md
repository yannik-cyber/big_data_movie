# Big Data Project

Wir, das sind
- Yannik Hubrich
- Philipp Becht
- Paula Hölterhoff
- Pascal Schmidt
- Simon Wrigg (5874903), 
haben im Rahmen der Vorlesungsreihe "Big Data" ein Movie Recommendation System hergestellt, welches dem Anwender nicht nur seine belibtesten Filme anzeigt, sondern auch, welches Genre dem Anwender am meisten gefällt.
Hierfür wurden die in den Vorlesungen kennengelernten Architekturen verwendet. Die Berechnung der beliebtesten Filme wird über XXX realisiert.


Um das Recommendation System zu starten, ist es zunächst notwendig die auf github abgelegte zip-Datei herunterzuladen und abzuspeichern.
Mithilfe einer shell muss dann zum Ordner hinnavigiert werden, wo das Projekt abgespeichert wurde.

Stellen Sie vorher sicher, dass sie die folgenden Prerequisites ausgeführt haben.
1) minikube start
3) minikube addons enable ingress
4) helm repo add strimzi http://strimzi.io/charts/
5) helm install my-kafka-operator strimzi/strimzi-kafka-operator
6) kubectl apply -f https://farberg.de/talks/big-data/code/helm-kafka-operator/kafka-cluster-def.yaml
7) skaffold dev


Bitte beachten Sie, dass Sie die folgenden Proxy-Einstellungen vornehmen müssen:
1)
2)
3)


Bei Rückfragen oder Problemen beim Ausführen unseres Projektes, helfen wir Ihnen gerne weiter!

